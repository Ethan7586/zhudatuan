import { OP_VOUCHER_BATCHES_ISSUE, OP_VOUCHER_BATCHES_RETRY, OP_VOUCHER_CARDLIBRARIES_ALLOCATE, OP_VOUCHER_REDEMPTIONS_REVERSE, OP_VOUCHER_RESERVES_DECIDE, OP_VOUCHER_STATUS_BATCH } from '@shop/contract/ids';
import type { VoucherDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherCommand } from '../model/VoucherCommand';

export async function execute(context: ConsoleContext, dependencies: VoucherDependencies, command: VoucherCommand): Promise<void> {
  if (command.kind === 'createlibrary') return dependencies.createLibrary.execute(context, command.prefix, command.identity);
  if (command.kind === 'allocatelibrary') return dependencies.allocateLibrary.execute(context, command);
  if (command.kind === 'saveprogram') return dependencies.saveProgram.execute(context, command.draft, command.identity);
  if (command.kind === 'requestreserve') return dependencies.requestReserve.execute(context, command);
  if (command.kind === 'decidereserve') return dependencies.decideReserve.execute(context, command);
  if (command.kind === 'issuebatch') return dependencies.issueBatch.execute(context, command);
  if (command.kind === 'retrybatch') return dependencies.retryBatch.execute(context, command);
  if (command.kind === 'statusbatch') return dependencies.changeStatus.execute(context, command);
  if (command.kind === 'bind') return dependencies.bind.execute(context, command);
  return dependencies.reverse.execute(context, command);
}

export function approvalEnvelope(command: VoucherCommand) {
  if (command.kind === 'allocatelibrary') return { operation: OP_VOUCHER_CARDLIBRARIES_ALLOCATE, version: command.version, input: { path: { libraryid: command.library }, body: { scope: command.scope, count: command.count } } };
  if (command.kind === 'decidereserve') return { operation: OP_VOUCHER_RESERVES_DECIDE, version: command.version, input: { path: { reserveid: command.reserve }, body: { decision: command.decision, reason: command.reason } } };
  if (command.kind === 'issuebatch')
    return { operation: OP_VOUCHER_BATCHES_ISSUE, version: command.version, input: { body: { program: command.program, cardpool: command.cardpool, count: command.count, ...(command.reserve ? { reserve: command.reserve } : {}) } } };
  if (command.kind === 'retrybatch') return { operation: OP_VOUCHER_BATCHES_RETRY, version: command.version, input: { path: { batchid: command.batch }, body: {} } };
  if (command.kind === 'statusbatch')
    return { operation: OP_VOUCHER_STATUS_BATCH, version: command.version, input: { body: { ids: command.ids, action: command.action, reason: command.reason, ...(command.expiresAt ? { expiresAt: command.expiresAt } : {}) } } };
  if (command.kind === 'reverse') return { operation: OP_VOUCHER_REDEMPTIONS_REVERSE, version: command.version, input: { path: { redemptionid: command.redemption }, body: { reason: command.reason } } };
  throw new Error('当前操作不需要双人复核。');
}

export function minor(value: string): number {
  if (!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('金额格式不正确。');
  return Math.round(Number(value) * 100);
}

export function validStatus(value?: string): 'draft' | 'active' | 'paused' | 'retired' {
  return value === 'active' || value === 'paused' || value === 'retired' ? value : 'draft';
}
