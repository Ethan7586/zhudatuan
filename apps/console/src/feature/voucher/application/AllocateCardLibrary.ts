import { OP_VOUCHER_CARDLIBRARIES_ALLOCATE } from '@shop/contract/ids';
import { PERM_VOUCHER_CARDLIBRARY_ALLOCATE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, positiveInteger } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class AllocateCardLibrary {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ library: string; version: number; scope: string; count: number; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, PERM_VOUCHER_CARDLIBRARY_ALLOCATE, OP_VOUCHER_CARDLIBRARIES_ALLOCATE, true, input.proof);
    if (!input.library || !input.scope) throw new Error('请选择卡号库并填写目标范围。');
    return this.port.allocateLibrary(context, { ...input, count: positiveInteger(input.count, '分配数量') }, signal);
  }
}
