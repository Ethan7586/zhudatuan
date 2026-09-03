import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason, positiveInteger } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class RequestVoucherReserve {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ program: string; count: number; reason: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.reserve.request', 'voucher.reserves.request');
    if (!input.program) throw new Error('请选择卡券方案。');
    return this.port.requestReserve(context, { ...input, count: positiveInteger(input.count, '备券数量'), reason: auditReason(input.reason) }, signal);
  }
}
