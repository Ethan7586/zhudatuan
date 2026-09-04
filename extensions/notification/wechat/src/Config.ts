import { secretRef, type SecretRef } from '@shop/contract';

export interface WechatConfiguration {
  readonly appId: string;
  readonly credentialRef: SecretRef;
  readonly page: string | null;
  readonly state: 'developer' | 'trial' | 'formal';
  readonly priority: number;
  readonly templates: Readonly<Record<string, Readonly<{ id: string; variables: Readonly<Record<string, string>> }>>>;
}

export function parseWechatConfiguration(value: unknown): WechatConfiguration {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('WECHAT_DELIVERY_CONFIGURATION_INVALID');
  const source = value as Readonly<Record<string, unknown>>;
  if (Object.keys(source).some((key) => !['appId', 'credentialRef', 'page', 'priority', 'state', 'templates'].includes(key))) throw new Error('WECHAT_DELIVERY_CONFIGURATION_INVALID');
  const page = source.page === undefined || source.page === null ? null : text(source.page);
  const priority = source.priority === undefined ? 10 : Number(source.priority);
  if (typeof source.appId !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(source.appId) ||
    !['developer', 'trial', 'formal'].includes(String(source.state)) ||
    (page !== null && !/^pages?\/[A-Za-z0-9/_-]{1,240}$/.test(page)) ||
    !Number.isSafeInteger(priority) || priority < 0 || priority > 1_000) throw new Error('WECHAT_DELIVERY_CONFIGURATION_INVALID');
  return Object.freeze({ appId: source.appId, credentialRef: secretRef(source.credentialRef), page,
    state: source.state as WechatConfiguration['state'], priority, templates: templateMap(source.templates) });
}

function templateMap(value: unknown): WechatConfiguration['templates'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('WECHAT_TEMPLATE_MAPPING_INVALID');
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 200) throw new Error('WECHAT_TEMPLATE_MAPPING_INVALID');
  const result: Record<string, Readonly<{ id: string; variables: Readonly<Record<string, string>> }>> = {};
  for (const [alias, candidate] of entries) {
    if (!/^[a-z][a-z0-9.:-]{2,127}$/.test(alias) || candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('WECHAT_TEMPLATE_MAPPING_INVALID');
    const source = candidate as Readonly<Record<string, unknown>>;
    if (Object.keys(source).sort().join(',') !== 'id,variables' || typeof source.id !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(source.id) ||
      source.variables === null || typeof source.variables !== 'object' || Array.isArray(source.variables)) throw new Error('WECHAT_TEMPLATE_MAPPING_INVALID');
    const variables: Record<string, string> = {};
    for (const [name, providerName] of Object.entries(source.variables as Readonly<Record<string, unknown>>)) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(name) || typeof providerName !== 'string' || !/^(?:thing|character_string|amount|date|time|phrase|number)\d{1,2}$/.test(providerName)) throw new Error('WECHAT_TEMPLATE_MAPPING_INVALID');
      variables[name] = providerName;
    }
    if (Object.keys(variables).length < 1 || new Set(Object.values(variables)).size !== Object.keys(variables).length) throw new Error('WECHAT_TEMPLATE_MAPPING_INVALID');
    result[alias] = Object.freeze({ id: source.id, variables: Object.freeze(variables) });
  }
  return Object.freeze(result);
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('WECHAT_DELIVERY_CONFIGURATION_INVALID');
  return value;
}
