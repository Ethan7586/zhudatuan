import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class ReverseVoucherRedemption {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ redemption: string; version: number; reason: string; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.redemption.reverse', 'voucher.redemptions.reverse', true, input.proof);
    return this.port.reverse(context, { ...input, reason: auditReason(input.reason) }, signal);
  }
}
