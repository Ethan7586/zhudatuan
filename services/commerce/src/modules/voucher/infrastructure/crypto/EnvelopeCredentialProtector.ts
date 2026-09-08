import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { CredentialBinding, CredentialProtector, ProtectedCredential } from '../../application/port/CredentialProtector';
import { CredentialSecret } from '../../domain/value/CredentialSecret';
import { VoucherNumber } from '../../domain/value/VoucherNumber';

const ID_PATTERN = /^[\p{L}\p{N}:./@-]{1,256}$/u;

export class EnvelopeCredentialProtector implements CredentialProtector {
  constructor(private readonly kms: KmsClient) {}

  async protect(value: string, purpose: 'number' | 'secret', binding: CredentialBinding): Promise<ProtectedCredential> {
    const normalized = credentialValue(value, purpose);
    const context = encryptionContext(purpose, binding);
    const [envelope, fingerprint] = await Promise.all([this.kms.encrypt('pii', `voucher/credential/${purpose}`, normalized, context), this.fingerprint(normalized, purpose, binding.scope)]);
    return Object.freeze({
      ciphertext: envelope.ciphertext,
      fingerprint,
      keyVersion: envelope.keyVersion,
      masked: purpose === 'number' ? maskNumber(normalized) : '******',
    });
  }

  reveal(ciphertext: string, purpose: 'number' | 'secret', binding: CredentialBinding): Promise<string> {
    if (typeof ciphertext !== 'string' || ciphertext.length < 16) throw new Error('VOUCHER_CREDENTIAL_CIPHERTEXT_INVALID');
    return this.kms.decrypt('pii', `voucher/credential/${purpose}`, ciphertext, encryptionContext(purpose, binding));
  }

  async fingerprint(value: string, purpose: 'number' | 'secret', scope: string): Promise<string> {
    const normalized = credentialValue(value, purpose);
    const safeScope = identifier(scope, 'VOUCHER_CREDENTIAL_SCOPE_INVALID');
    const envelope = await this.kms.encrypt('pii', `voucher/index/${purpose}`, normalized, {
      domain: 'voucher',
      purpose,
      scope: safeScope,
      use: 'lookup',
    });
    return envelope.fingerprint;
  }
}

function encryptionContext(purpose: 'number' | 'secret', binding: CredentialBinding): Readonly<Record<string, string>> {
  return Object.freeze({
    credential: identifier(binding.credential, 'VOUCHER_CREDENTIAL_ID_INVALID'),
    domain: 'voucher',
    pool: identifier(binding.pool, 'VOUCHER_CREDENTIAL_POOL_INVALID'),
    purpose,
    scope: identifier(binding.scope, 'VOUCHER_CREDENTIAL_SCOPE_INVALID'),
    use: 'credential',
  });
}

function credentialValue(value: string, purpose: 'number' | 'secret'): string {
  return purpose === 'number' ? new VoucherNumber(value).value : new CredentialSecret(value).value;
}

function identifier(value: string, code: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error(code);
  return value;
}

function maskNumber(value: string): string {
  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(4, [...value].length - [...visible].length))}${visible}`;
}
