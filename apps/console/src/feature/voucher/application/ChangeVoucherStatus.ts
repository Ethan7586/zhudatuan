import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class ChangeVoucherStatus {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ ids: readonly string[]; version: number; action: 'activate' | 'disable' | 'extend' | 'void'; reason: string; expiresAt?: string; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.status.manage', 'voucher.status.batch', true, input.proof);
    const ids = Object.freeze([...new Set(input.ids.filter(Boolean))]);
    if (ids.length === 0 || ids.length > 100_000) throw new Error('请选择 1–100000 张卡券。');
    if (input.action === 'extend' && (!input.expiresAt || new Date(input.expiresAt).getTime() <= Date.now())) throw new Error('延期日期必须晚于当前时间。');
    return this.port.changeStatus(context, { ...input, ids, reason: auditReason(input.reason) }, signal);
  }
}
