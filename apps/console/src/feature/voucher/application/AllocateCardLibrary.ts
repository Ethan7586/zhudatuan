import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, positiveInteger } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class AllocateCardLibrary {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ library: string; version: number; scope: string; count: number; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.cardlibrary.allocate', 'voucher.cardlibraries.allocate', true, input.proof);
    if (!input.library || !input.scope) throw new Error('请选择卡号库并填写目标范围。');
    return this.port.allocateLibrary(context, { ...input, count: positiveInteger(input.count, '分配数量') }, signal);
  }
}
