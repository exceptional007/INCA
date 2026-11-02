import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Configurable HTTPS delivery adapter. Never logs recovery credentials. */
@Injectable()
export class PasswordMailService {
  constructor(private readonly config: ConfigService) {}
  private settings() {
    const endpoint = this.config.get<string>('PASSWORD_MAIL_API_URL');
    const key = this.config.get<string>('PASSWORD_MAIL_API_KEY');
    const origin = this.config.get<string>('FRONTEND_URL');
    const provider =
      this.config.get<string>('PASSWORD_MAIL_PROVIDER') || 'gateway';
    let endpointUrl: URL, originUrl: URL;
    try {
      endpointUrl = new URL(endpoint || '');
      originUrl = new URL(origin || '');
    } catch {
      throw new ServiceUnavailableException(
        'Password recovery email is not configured. Contact your administrator.',
      );
    }
    if (
      !key ||
      endpointUrl.protocol !== 'https:' ||
      endpointUrl.username ||
      endpointUrl.password ||
      !['http:', 'https:'].includes(originUrl.protocol) ||
      originUrl.username ||
      originUrl.password ||
      !['gateway', 'google-apps-script'].includes(provider)
    )
      throw new ServiceUnavailableException(
        'Password recovery email is not configured. Contact your administrator.',
      );
    if (
      provider === 'google-apps-script' &&
      (endpointUrl.hostname !== 'script.google.com' ||
        !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpointUrl.pathname) ||
        !/^[a-f0-9]{64}$/.test(key))
    )
      throw new ServiceUnavailableException(
        'Google recovery gateway configuration is invalid. Contact your administrator.',
      );
    return { endpoint: endpoint!, key, origin: origin!, provider };
  }
  async send(to: string, token: string) {
    const { endpoint, key, origin, provider } = this.settings();
    const link = new URL('/reset-password', origin);
    link.hash = new URLSearchParams({ token }).toString();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(
          provider === 'google-apps-script' ? 20000 : 10000,
        ),
        headers: {
          'Content-Type': 'application/json',
          ...(provider === 'gateway' ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          ...(provider === 'google-apps-script' ? { apiKey: key } : {}),
          to,
          subject: 'Reset your INCA password',
          text: `Use this single-use link within 20 minutes to reset your INCA password: ${link.toString()}\nIf you did not request this, ignore this message.`,
        }),
      });
      if (!response.ok) throw new Error('Delivery failed');
      if (
        provider === 'google-apps-script' &&
        (await response.json()).success !== true
      )
        throw new Error('Delivery rejected');
    } catch {
      throw new ServiceUnavailableException(
        'Password recovery email is temporarily unavailable.',
      );
    }
  }
  assertConfigured() {
    this.settings();
  }
}
