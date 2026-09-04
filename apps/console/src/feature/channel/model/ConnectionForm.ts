import type { ProviderUiCatalog } from '@shop/contract';
import type { ConnectionDraft } from './Channel';

export type ConnectionValues = Readonly<Record<string, string>>;

export function initialConnectionValues(provider: ProviderUiCatalog): ConnectionValues {
  return Object.freeze(Object.fromEntries(provider.form.fields.map((field) => [field.key, field.initial])));
}

export function buildConnectionDraft(provider: ProviderUiCatalog, values: ConnectionValues): ConnectionDraft {
  const endpoints = Object.fromEntries(
    provider.form.fields
      .filter((field) => field.kind === 'endpoint' && field.operation)
      .map((field) => [field.operation!, values[field.key]?.trim() ?? ''])
  );
  const baseUrl = values.baseUrl?.trim();
  return Object.freeze({
    provider: provider.id,
    region: values.region?.trim() ?? '',
    ...(baseUrl ? { baseUrl } : {}),
    healthOperation: provider.form.healthOperation,
    endpoints: Object.freeze(endpoints),
    secretRef: values.secretRef?.trim() ?? '',
  });
}

export function validateConnectionDraft(provider: ProviderUiCatalog, draft: ConnectionDraft, updating: boolean): string | undefined {
  for (const field of provider.form.fields) {
    const value = fieldValue(field.key, field.operation, draft);
    if (field.required && !(updating && field.kind === 'secretref') && !value) return `请填写${field.label}。`;
    if (!value) continue;
    if (field.kind === 'url' && !safeHttps(value)) return `${field.label}必须是无账号、查询参数和片段的 HTTPS 地址。`;
    if (field.kind === 'secretref' && !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(value)) return `${field.label}必须填写密钥管理系统中的安全引用，不能填写明文密钥。`;
    if (field.kind === 'endpoint' && (!value.startsWith('/') || value.startsWith('//') || value.includes('?') || value.includes('#'))) return `${field.label}必须是无域名、查询参数和片段的相对路径。`;
  }
  if (!draft.region || !draft.healthOperation) return '部署区域和扩展健康检查配置不能为空。';
  return undefined;
}

function fieldValue(key: string, operation: string | undefined, draft: ConnectionDraft): string {
  if (operation) return draft.endpoints[operation] ?? '';
  if (key === 'region') return draft.region;
  if (key === 'baseUrl') return draft.baseUrl ?? '';
  if (key === 'secretRef') return draft.secretRef;
  return '';
}

function safeHttps(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
