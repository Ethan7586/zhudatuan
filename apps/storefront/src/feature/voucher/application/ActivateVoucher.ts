import type { StorefrontSession } from '../../../entity/session';
import { credentialSecret, voucherNumber } from '@shop/contract/voucher';
import { activationError, type ActivationDraft } from '../model/Activation';
import type { VoucherPort } from '../public/VoucherPort';

export class ActivateVoucher {
  constructor(private readonly vouchers: Pick<VoucherPort, 'activate'>) {}
  execute(session: StorefrontSession, draft: ActivationDraft, signal: AbortSignal) {
    if (activationError(draft)) throw new Error('VALIDATION_FAILED');
    const secret = credentialSecret(draft.secret)!;
    return this.vouchers.activate(session, draft.mode === 'numbersecret'
      ? { mode: 'numbersecret', number: voucherNumber(draft.number)!, secret }
      : { mode: 'secret', secret }, draft.key, signal);
  }
}
