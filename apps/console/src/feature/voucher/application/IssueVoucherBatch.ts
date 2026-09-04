import { OP_VOUCHER_BATCHES_ISSUE } from '@shop/contract/ids';
import { PERM_VOUCHER_ISSUE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess, positiveInteger } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class IssueVoucherBatch {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ program: string; version: number; cardpool: string; count: number; reserve?: string; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, PERM_VOUCHER_ISSUE, OP_VOUCHER_BATCHES_ISSUE, true, input.proof);
    if (!input.program || !input.cardpool) throw new Error('请选择卡券方案和卡号库。');
    return this.port.issueBatch(context, { ...input, count: positiveInteger(input.count, '发行数量') }, signal);
  }
}
