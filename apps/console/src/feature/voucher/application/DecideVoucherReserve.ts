import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class DecideVoucherReserve {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ reserve: string; version: number; decision: 'approved' | 'rejected'; reason: string; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.reserve.decide', 'voucher.reserves.decide', true, input.proof);
    return this.port.decideReserve(context, { ...input, reason: auditReason(input.reason) }, signal);
  }
}
