import { OP_VOUCHER_REDEMPTIONS_REVERSE } from '@shop/contract/ids';
import { PERM_VOUCHER_REDEMPTION_REVERSE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class ReverseVoucherRedemption {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ redemption: string; version: number; reason: string; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, PERM_VOUCHER_REDEMPTION_REVERSE, OP_VOUCHER_REDEMPTIONS_REVERSE, true, input.proof);
    return this.port.reverse(context, { ...input, reason: auditReason(input.reason) }, signal);
  }
}
