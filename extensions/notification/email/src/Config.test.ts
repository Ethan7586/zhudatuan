import { describe, expect, it } from 'vitest';

import { parseEmailConfiguration } from './Config';

describe('email provider configuration', () => {
  it('accepts only a public HTTPS endpoint and a Secret reference', () => {
    expect(parseEmailConfiguration({ endpoint: 'https://mail.example.test', provider: 'mailer', sender: 'shop@example.test', credentialRef: 'secret/notification/email', priority: 20 }))
      .toMatchObject({ endpoint: 'https://mail.example.test', credentialRef: 'secret/notification/email' });
    expect(() => parseEmailConfiguration({ endpoint: 'https://127.0.0.1', provider: 'mailer', sender: 'shop@example.test', credentialRef: 'secret/notification/email' }))
      .toThrow('EMAIL_CONFIGURATION_INVALID');
    expect(() => parseEmailConfiguration({ endpoint: 'https://mail.example.test', provider: 'mailer', sender: 'shop@example.test', credentialRef: 'secret/notification/email', bearer: 'inline-secret' }))
      .toThrow('EMAIL_CONFIGURATION_INVALID');
  });
});
