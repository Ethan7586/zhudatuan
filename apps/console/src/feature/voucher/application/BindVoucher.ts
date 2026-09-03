import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class BindVoucher {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ voucher: string; version: number; member: string; reason: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.binding.manage', 'voucher.bindings.manage');
    if (!input.voucher || !input.member.trim()) throw new Error('请选择卡券并填写成员编号。');
    return this.port.bind(context, { ...input, member: input.member.trim(), reason: auditReason(input.reason) }, signal);
  }
}
