import type { VoucherRepository } from '../port/VoucherRepository';
import type { ActivationLookup } from '../port/ActivationRate';
import type { CredentialProtector } from '../port/CredentialProtector';
import { VoucherNumber } from '../../domain/value/VoucherNumber';
import { CredentialSecret } from '../../domain/value/CredentialSecret';
export class VoucherActivation {
  constructor(
    private readonly vouchers: Pick<VoucherRepository, 'activateSecret' | 'activateNumber'>,
    private readonly protector: Pick<CredentialProtector, 'fingerprint'>
  ) {}
  async prepare(scope: string, secret: string, number?: string): Promise<ActivationLookup> {
    const normalized = number === undefined ? undefined : new VoucherNumber(number).value;
    const verifiedSecret = new CredentialSecret(secret).value;
    const [secretFingerprint, numberFingerprint] = await Promise.all([this.protector.fingerprint(verifiedSecret, 'secret', scope), normalized === undefined ? Promise.resolve(null) : this.protector.fingerprint(normalized, 'number', scope)]);
    return Object.freeze({ secretFingerprint, numberFingerprint });
  }
  secret(call: Parameters<VoucherRepository['activateSecret']>[0], lookup: ActivationLookup) {
    return this.vouchers.activateSecret(call, lookup);
  }
  number(call: Parameters<VoucherRepository['activateNumber']>[0], lookup: ActivationLookup) {
    return this.vouchers.activateNumber(call, lookup);
  }
}
