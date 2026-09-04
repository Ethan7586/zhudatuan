import { OP_CHANNEL_CONNECTIONS_READ, OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import type { ImportRegistryPort } from '../../../app/registry/ImportRegistry';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { validateImportFile } from '../../../shared/import/ImportUploadGateway';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import type { ImportDraft, ImportProviderOptions } from '../model/ImportDraft';

export function canCreateImport(context: ConsoleContext, registry: ImportRegistryPort, kind: ImportDraft['kind']): boolean {
  return canUseOperation(context, OP_RUNTIME_UPLOADS_CREATE)
    && canUseOperation(context, registry.get(kind).operation)
    && (kind !== 'finance' || canUseOperation(context, OP_CHANNEL_CONNECTIONS_READ));
}

export function validateImportDraft(draft: ImportDraft | undefined, assurance: number, providers: ImportProviderOptions | undefined, providersPending: boolean, providerError: string | undefined): string | undefined {
  if (!draft || draft.step === 1) return undefined;
  if (!draft.file) return '请选择 CSV 或 XLSX 文件。';
  const fileError = validateImportFile(draft.file);
  if (fileError) return fileError;
  if (draft.step === 2) return undefined;
  if (draft.kind === 'voucher' && (draft.pool.trim().length < 3 || draft.pool.length > 255)) return '请选择或填写有效的卡号库。';
  if (draft.kind === 'finance') {
    if (providersPending) return '正在读取可用渠道，请稍候。';
    if (providerError) return providerError;
    if (!providers || providers.items.length === 0) return providers?.reason ?? '当前范围没有可用于账单导入的渠道连接。';
    if (!providers.items.some(({ value }) => value === draft.provider)) return '请选择一个已启用且通过连通性检查的渠道。';
    if (!draft.partnerId.trim() || draft.partnerId.length > 128) return '请填写有效的结算伙伴。';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.periodEnd) || draft.periodStart > draft.periodEnd) return '请选择正确的账期起止日期。';
    if (![draft.openingMinor, draft.closingMinor].every((value) => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)))) return '期初与期末余额须填写为整数分。';
  }
  if (!draft.confirmed) return '请确认已理解预检与执行范围。';
  return assurance < 2 ? '请先完成二次验证。' : undefined;
}
