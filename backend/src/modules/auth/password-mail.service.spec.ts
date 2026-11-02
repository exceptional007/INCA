import { PasswordMailService } from './password-mail.service';
import { setRefresh, assertOrigin } from './session.controller';

describe('Password recovery transport and cookie configuration', () => {
  const config = (overrides: Record<string, string | undefined> = {}) =>
    ({
      get: (key: string) =>
        ({
          FRONTEND_URL: 'https://campus.example',
          PASSWORD_MAIL_API_URL: 'https://mail-gateway.example/send',
          PASSWORD_MAIL_API_KEY: 'test-only-mail-key',
          NODE_ENV: 'production',
          ...overrides,
        })[key],
    }) as any;
  afterEach(() => jest.restoreAllMocks());
  it('authenticates Google Apps Script in the JSON body and validates delivery acknowledgement', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    const c = config({
      PASSWORD_MAIL_PROVIDER: 'google-apps-script',
      PASSWORD_MAIL_API_URL:
        'https://script.google.com/macros/s/test-deployment/exec',
      PASSWORD_MAIL_API_KEY: 'a'.repeat(64),
    });
    await new PasswordMailService(c).send('demo@bit.ac.in', 'r'.repeat(43));
    expect(fetch.mock.calls[0][0]).toBe(
      'https://script.google.com/macros/s/test-deployment/exec',
    );
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toMatchObject({
      apiKey: 'a'.repeat(64),
      to: 'demo@bit.ac.in',
    });
  });
  it.each([{ success: false }, { ready: true }])(
    'rejects Google gateway error acknowledgements %p',
    async (body) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true, json: async () => body } as Response);
      await expect(
        new PasswordMailService(
          config({
            PASSWORD_MAIL_PROVIDER: 'google-apps-script',
            PASSWORD_MAIL_API_URL:
              'https://script.google.com/macros/s/test-deployment/exec',
            PASSWORD_MAIL_API_KEY: 'a'.repeat(64),
          }),
        ).send('demo@bit.ac.in', 'r'.repeat(43)),
      ).rejects.toMatchObject({ status: 503 });
    },
  );
  it.each([
    'https://hostile.example/exec',
    'https://script.google.com/macros/s/test/dev',
    'http://script.google.com/macros/s/test/exec',
  ])(
    'does not send Google credentials to invalid endpoint %s',
    async (endpoint) => {
      const fetch = jest.spyOn(globalThis, 'fetch');
      await expect(
        new PasswordMailService(
          config({
            PASSWORD_MAIL_PROVIDER: 'google-apps-script',
            PASSWORD_MAIL_API_URL: endpoint,
            PASSWORD_MAIL_API_KEY: 'a'.repeat(64),
          }),
        ).send('demo@bit.ac.in', 'r'.repeat(43)),
      ).rejects.toMatchObject({ status: 503 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('sends the documented gateway contract with a fragment-only single-use URL', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    await new PasswordMailService(config()).send(
      'demo@bit.ac.in',
      'r'.repeat(43),
    );
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('https://mail-gateway.example/send');
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer test-only-mail-key',
    });
    const body = JSON.parse(request!.body as string);
    expect(body.to).toBe('demo@bit.ac.in');
    expect(body.text).toContain(
      'https://campus.example/reset-password#token=' + 'r'.repeat(43),
    );
    expect(body.text).not.toContain('?token=');
    expect(body).not.toHaveProperty('password');
  });
  it.each([{}, { ok: false }])(
    'redacts provider failures: %p',
    async (response) => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(response as Response);
      await expect(
        new PasswordMailService(config()).send('demo@bit.ac.in', 'token'),
      ).rejects.toMatchObject({ status: 503 });
    },
  );
  it('redacts network errors', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('provider secret'));
    await expect(
      new PasswordMailService(config()).send('demo@bit.ac.in', 'token'),
    ).rejects.toThrow('temporarily unavailable');
  });
  it.each([
    { PASSWORD_MAIL_API_KEY: undefined },
    { PASSWORD_MAIL_API_URL: 'http://insecure.example' },
    { FRONTEND_URL: undefined },
  ])(
    'rejects missing or insecure delivery configuration %p',
    async (overrides) => {
      const fetch = jest.spyOn(globalThis, 'fetch');
      await expect(
        new PasswordMailService(config(overrides)).send(
          'demo@bit.ac.in',
          'token',
        ),
      ).rejects.toMatchObject({ status: 503 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('uses Secure, HttpOnly, scoped SameSite=None cookies for configured production cross-site hosts', () => {
    const res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      setHeader: jest.fn(),
    };
    setRefresh(
      res as any,
      config({ AUTH_COOKIE_SAME_SITE: 'none' }),
      'test-token',
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'inca_refresh',
      'test-token',
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        path: '/api/v1/auth',
      }),
    );
    setRefresh(res as any, config({ AUTH_COOKIE_SAME_SITE: 'none' }));
    expect(res.clearCookie).toHaveBeenCalledWith(
      'inca_refresh',
      expect.objectContaining({
        secure: true,
        sameSite: 'none',
        path: '/api/v1/auth',
      }),
    );
  });
  it('rejects untrusted and cross-site originless browser requests', () => {
    expect(() =>
      assertOrigin(
        { headers: { origin: 'https://hostile.example' } } as any,
        config(),
      ),
    ).toThrow();
    expect(() =>
      assertOrigin(
        { headers: { 'sec-fetch-site': 'cross-site' } } as any,
        config(),
      ),
    ).toThrow();
    expect(() =>
      assertOrigin(
        { headers: { origin: 'https://campus.example' } } as any,
        config(),
      ),
    ).not.toThrow();
  });
});
