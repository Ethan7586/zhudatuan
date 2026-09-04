import { OP_VOUCHER_BINDINGS_MANAGE } from '@shop/contract/ids';
import { PERM_VOUCHER_BINDING_MANAGE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, auditReason } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class BindVoucher {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ voucher: string; version: number; member: string; reason: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, PERM_VOUCHER_BINDING_MANAGE, OP_VOUCHER_BINDINGS_MANAGE);
    if (!input.voucher || !input.member.trim()) throw new Error('请选择卡券并填写成员编号。');
    return this.port.bind(context, { ...input, member: input.member.trim(), reason: auditReason(input.reason) }, signal);
  }
}
