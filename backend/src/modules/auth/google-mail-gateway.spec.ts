import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

describe('Google Apps Script recovery-only gateway', () => {
  const key = 'a'.repeat(64),
    token = 'r'.repeat(43),
    origin = 'https://campus.example';
  let context: any, properties: Record<string, string>, quota: number;
  const send = jest.fn();
  beforeEach(() => {
    send.mockReset();
    properties = {
      INCA_MAIL_API_KEY: key,
      INCA_FRONTEND_URL: origin,
      INCA_RECIPIENT_DOMAIN: 'bit.ac.in',
    };
    quota = 100;
    context = {
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k: string) => properties[k],
        }),
      },
      MailApp: { getRemainingDailyQuota: () => quota, sendEmail: send },
      Utilities: {
        DigestAlgorithm: { SHA_256: 'sha256' },
        computeDigest: (_algorithm: string, input: string) =>
          Array.from(createHash('sha256').update(input).digest()),
      },
      ContentService: {
        MimeType: { JSON: 'application/json' },
        createTextOutput: (text: string) => ({ setMimeType: () => ({ text }) }),
      },
    };
    vm.createContext(context);
    vm.runInContext(
      readFileSync(
        resolve(__dirname, '../../../../ops/google-apps-script/Code.gs'),
        'utf8',
      ),
      context,
    );
  });
  const payload = () => ({
    apiKey: key,
    to: 'demo@bit.ac.in',
    subject: 'Reset your INCA password',
    text: `Use this single-use link within 20 minutes to reset your INCA password: ${origin}/reset-password#token=${token}\nIf you did not request this, ignore this message.`,
  });
  const request = (body: object) =>
    JSON.parse(
      context.doPost({ postData: { contents: JSON.stringify(body) } }).text,
    );
  it('sends only the fixed recovery template to a permitted recipient', () => {
    expect(request(payload())).toEqual({ success: true });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'demo@bit.ac.in',
        subject: 'Reset your INCA password',
        body: payload().text,
      }),
    );
  });
  it.each(['', 'b'.repeat(64), 'short'])(
    'blocks missing or incorrect shared secrets',
    (secret) => {
      expect(request({ ...payload(), apiKey: secret })).toEqual({
        success: false,
      });
      expect(send).not.toHaveBeenCalled();
    },
  );
  it.each([
    { to: 'outsider@example.com' },
    { to: 'demo@bit.ac.in,outsider@example.com' },
    { subject: 'Unrelated message' },
    { text: 'Unrelated content' },
    { text: 'https://hostile.example/reset-password#token=' + token },
  ])('rejects relay misuse %p', (override) => {
    expect(request({ ...payload(), ...override })).toEqual({ success: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('allows only an explicitly configured external test recipient', () => {
    properties.INCA_TEST_RECIPIENT = 'owner@gmail.com';
    expect(request({ ...payload(), to: 'owner@gmail.com' })).toEqual({
      success: true,
    });
  });
  it('supports authenticated connection checks without sending email', () => {
    expect(request({ apiKey: key, action: 'check' })).toEqual({
      success: true,
      ready: true,
    });
    expect(send).not.toHaveBeenCalled();
    quota = 0;
    expect(request({ apiKey: key, action: 'check' })).toEqual({
      success: true,
      ready: false,
    });
  });
  it('does not send when quota is exhausted or mail fails', () => {
    quota = 0;
    expect(request(payload())).toEqual({ success: false });
    expect(send).not.toHaveBeenCalled();
    quota = 100;
    send.mockImplementation(() => {
      throw new Error('provider failure');
    });
    expect(request(payload())).toEqual({ success: false });
  });
  it('rejects malformed or oversized input without exposing internal errors', () => {
    expect(
      JSON.parse(
        context.doPost({ postData: { contents: 'invalid JSON' } }).text,
      ),
    ).toEqual({ success: false });
    expect(
      JSON.parse(
        context.doPost({ postData: { contents: 'x'.repeat(12001) } }).text,
      ),
    ).toEqual({ success: false });
    expect(send).not.toHaveBeenCalled();
  });
});
