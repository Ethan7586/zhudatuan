import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherCommand } from '../model/VoucherCommand';
import type { VoucherView } from '../model/Voucher';

export function readView(search: URLSearchParams, available: readonly VoucherView[]): VoucherView {
  const selected = search.get('view') as VoucherView | null;
  return selected && available.includes(selected) ? selected : (available[0] ?? 'programs');
}

export function allowed(context: ConsoleContext, permission: string, capability: string): boolean {
  return context.session.permissions.includes(permission) && context.session.capabilities.includes(capability);
}

export function targetView(command: VoucherCommand): VoucherView {
  if (command.kind === 'createlibrary' || command.kind === 'allocatelibrary') return 'libraries';
  if (command.kind === 'saveprogram') return 'programs';
  if (command.kind === 'requestreserve' || command.kind === 'decidereserve') return 'reserves';
  if (command.kind === 'issuebatch' || command.kind === 'retrybatch') return 'batches';
  if (command.kind === 'statusbatch') return 'statusbatches';
  if (command.kind === 'bind') return 'bindings';
  return 'redemptions';
}

export function receiptText(command: VoucherCommand): string {
  return command.kind === 'statusbatch' ? `已提交 ${command.ids.length} 张卡券的批量任务，请在“操作批次”查看进度。` : '操作已提交并完成权威重读；若为异步任务，可在对应列表查看最新进度。';
}
