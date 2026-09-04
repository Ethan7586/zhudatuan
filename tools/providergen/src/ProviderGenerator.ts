import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

interface ProviderRecord {
  readonly id: string;
  readonly name: string;
  readonly priority: 1;
  readonly extension: string;
  readonly package: string;
  readonly factory: string;
  readonly core: string;
  readonly version: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly dependencies: readonly Readonly<{ id: string; version: string; capabilities: readonly string[] }>[];
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly configSchema: string;
  readonly secretRefs: readonly string[];
  readonly sandbox: Readonly<{ supported: true; mode: 'endpoint' | 'local'; endpointRef: string | null }>;
  readonly health: Readonly<{ operation: string }>;
  readonly rateLimit: Readonly<{ requestsPerSecond: number; maxConcurrency: number }>;
  readonly timeout: Readonly<{ connectionMs: number; responseMs: number; totalMs: number }>;
  readonly retry: Readonly<{ maxAttempts: number }>;
  readonly circuit: Readonly<{ failureThreshold: number; recoveryMs: number }>;
  readonly webhook: Readonly<{ contract: string | null; events: readonly string[] }>;
}

interface ProviderDocument {
  readonly generated?: boolean;
  readonly source?: string;
  readonly providers?: readonly ProviderRecord[];
}

interface ProviderUiField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'text' | 'url' | 'secretref' | 'endpoint';
  readonly required: boolean;
  readonly initial: string;
  readonly placeholder: string;
  readonly help: string;
  readonly operation?: string;
}

interface ProviderUiForm {
  readonly schema: string;
  readonly healthOperation: string;
  readonly secretRefs: readonly string[];
  readonly fields: readonly ProviderUiField[];
}

interface ProviderUiRecord {
  readonly id: string;
  readonly name: string;
  readonly business: string;
  readonly clients: readonly string[];
  readonly settings: readonly string[];
  readonly help: string;
  readonly transport: 'endpoint' | 'local';
  readonly capabilities: readonly string[];
  readonly form: ProviderUiForm;
}

const root = resolve(import.meta.dirname, '../../..');
const document = parse(await readFile(resolve(root, 'config/providers.yml'), 'utf8')) as ProviderDocument;
if (document.generated !== true || document.source !== 'docs/requirements/source.yml#providers+extensions/channel/*/Manifest.ts') throw new Error('PROVIDER_CONFIG_AUTHORITY_INVALID');
const providers = document.providers ?? [];
const uiCatalogs: ProviderUiRecord[] = [];
if (providers.length !== 11) throw new Error('PROVIDER_CONFIG_COUNT_INVALID:' + providers.length);
if (new Set(providers.map(({ id }) => id)).size !== providers.length) throw new Error('PROVIDER_CONFIG_ID_DUPLICATE');

const expectedCapabilities = Object.freeze({
  jdproduct: ['Catalog', 'Price', 'Inventory', 'Order', 'Cancel', 'Return', 'Logistics', 'Refund', 'Statement', 'Webhook'],
  jdfresh: ['Catalog', 'GeoStock', 'TimeSlot', 'Order', 'Cancel', 'Refund', 'Delivery', 'Statement', 'Webhook'],
  tmall: ['Catalog', 'Price', 'Inventory', 'Order', 'Cancel', 'Return', 'Logistics', 'Refund', 'Statement', 'Webhook'],
  supplier: ['Catalog', 'Price', 'Inventory', 'Order', 'Shipment', 'Return', 'Refund', 'Statement'],
  cake: ['Catalog', 'GeoStore', 'TimeSlot', 'Order', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Verify', 'Webhook'],
  flower: ['Catalog', 'GeoDelivery', 'TimeSlot', 'Order', 'Substitute', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Webhook'],
  book: ['Catalog', 'Price', 'Inventory', 'Order', 'Cancel', 'Return', 'Shipment', 'Refund', 'Statement', 'Webhook'],
  charge: ['Catalog', 'Issue', 'DirectCharge', 'Query', 'Refund', 'Statement', 'Verify', 'Webhook'],
  foodvoucher: ['Catalog', 'GeoStore', 'Issue', 'Bind', 'Verify', 'Void', 'Extend', 'Refund', 'Statement', 'Webhook'],
  movie: ['Cinema', 'Show', 'SeatLock', 'Order', 'Issue', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
  meal: ['Brand', 'Store', 'Menu', 'Option', 'Price', 'Inventory', 'Order', 'Pickup', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
} as const);

for (const provider of providers) {
  if (!/^[a-z][a-z0-9]*$/.test(provider.id) || !provider.name || provider.priority !== 1 || provider.extension !== `extensions/channel/${provider.id}` || provider.package !== '@shop/provider' + provider.id || provider.factory !== provider.id[0]!.toUpperCase() + provider.id.slice(1) + 'Provider') {
    throw new Error('PROVIDER_CONFIG_RECORD_INVALID:' + provider.id);
  }
  const manifest = JSON.parse(await readFile(resolve(root, 'extensions/channel', provider.id, 'package.json'), 'utf8')) as {
    readonly name?: string;
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  if (manifest.name !== provider.package) throw new Error('PROVIDER_PACKAGE_ID_MISMATCH:' + provider.id);
  if (provider.core !== 'local' && provider.core !== 'self' && manifest.dependencies?.['@shop/provider' + provider.core] !== '1.0.0') throw new Error('PROVIDER_CORE_DEPENDENCY_MISSING:' + provider.id);
  if (provider.core === 'self' && Object.keys(manifest.dependencies ?? {}).some((dependency) => dependency.endsWith('core') && dependency !== '@shop/providercore')) throw new Error('PROVIDER_FOLDED_CORE_DEPENDENCY_PRESENT:' + provider.id);
  const loaded = (await import(pathToFileURL(resolve(root, provider.extension, 'Manifest.ts')).href)) as { readonly definition?: Readonly<Record<string, unknown>> };
  if (!loaded.definition) throw new Error('PROVIDER_MANIFEST_DEFINITION_MISSING:' + provider.id);
  const definition = loaded.definition;
  const catalogName = provider.id[0]!.toUpperCase() + provider.id.slice(1) + 'Catalog';
  const catalogModule = (await import(pathToFileURL(resolve(root, provider.extension, 'Catalog.ts')).href)) as Readonly<Record<string, unknown>>;
  const catalog = catalogModule[catalogName] as { readonly id?: string; readonly name?: string; readonly business?: string; readonly clients?: readonly string[]; readonly settings?: readonly string[]; readonly help?: string } | undefined;
  if (!catalog || catalog.id !== provider.id || !catalog.name || !catalog.business || !catalog.clients?.length || !catalog.settings?.length || !catalog.help) throw new Error('PROVIDER_UI_CATALOG_INVALID:' + provider.id);
  const factoryModule = (await import(pathToFileURL(resolve(root, provider.extension, 'Factory.ts')).href)) as Readonly<Record<string, unknown>>;
  const factory = factoryModule[provider.factory] as Readonly<{ id?: string; transport?: string; operations?: readonly string[] }> | undefined;
  if (!factory || factory.id !== provider.id || !factory.operations || (factory.transport === 'local') !== (provider.sandbox.mode === 'local')) throw new Error('PROVIDER_UI_FACTORY_INVALID:' + provider.id);
  uiCatalogs.push(Object.freeze({ id: catalog.id, name: catalog.name, business: catalog.business, clients: Object.freeze([...catalog.clients]), settings: Object.freeze([...catalog.settings]), help: catalog.help, transport: provider.sandbox.mode, capabilities: Object.freeze([...provider.capabilities]), form: providerForm(provider, factory.operations) }));
  const snapshot = {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    apiVersion: definition.apiVersion,
    contractVersion: definition.contractVersion,
    dependencies: definition.dependencies,
    capabilities: definition.capabilities,
    permissions: definition.permissions,
    configSchema: definition.configSchema,
    secretRefs: definition.secretRefs,
    sandbox: definition.sandbox,
    health: { operation: definition.healthOperation },
    rateLimit: definition.rateLimits,
    timeout: definition.timeout,
    retry: definition.retryPolicy,
    circuit: definition.circuitPolicy,
    webhook: { contract: definition.webhookContract, events: definition.eventSubscriptions },
  };
  const configured = {
    id: provider.id,
    name: provider.name,
    version: provider.version,
    apiVersion: provider.apiVersion,
    contractVersion: provider.contractVersion,
    dependencies: provider.dependencies,
    capabilities: provider.capabilities,
    permissions: provider.permissions,
    configSchema: provider.configSchema,
    secretRefs: provider.secretRefs,
    sandbox: provider.sandbox,
    health: provider.health,
    rateLimit: provider.rateLimit,
    timeout: provider.timeout,
    retry: provider.retry,
    circuit: provider.circuit,
    webhook: provider.webhook,
  };
  if (stableJson(snapshot) !== stableJson(configured)) throw new Error('PROVIDER_MANIFEST_CONFIG_DRIFT:' + provider.id);
  const expected = expectedCapabilities[provider.id as keyof typeof expectedCapabilities];
  if (!expected || stableJson(provider.capabilities) !== stableJson(expected)) throw new Error('PROVIDER_CAPABILITY_MATRIX_INVALID:' + provider.id);
  if (!/^\d+\.\d+\.\d+$/.test(provider.version) || !/^\d{4}-\d{2}-\d{2}$/.test(provider.apiVersion) || provider.contractVersion !== `${provider.id}.v1`) throw new Error('PROVIDER_VERSION_INVALID:' + provider.id);
  if (!provider.sandbox.supported || (provider.id === 'supplier') !== (provider.sandbox.mode === 'local')) throw new Error('PROVIDER_SANDBOX_INVALID:' + provider.id);
  if (provider.health.operation !== (provider.id === 'supplier' ? 'local' : 'health')) throw new Error('PROVIDER_HEALTH_INVALID:' + provider.id);
  if (provider.rateLimit.requestsPerSecond <= 0 || provider.rateLimit.maxConcurrency <= 0 || provider.timeout.connectionMs <= 0 || provider.timeout.responseMs < provider.timeout.connectionMs || provider.timeout.totalMs < provider.timeout.responseMs || provider.retry.maxAttempts < 1 || provider.retry.maxAttempts > 5 || provider.circuit.failureThreshold < 1 || provider.circuit.recoveryMs < 100) throw new Error('PROVIDER_RESILIENCE_INVALID:' + provider.id);
  const hasWebhook = provider.capabilities.includes('Webhook');
  if (hasWebhook !== (provider.webhook.contract !== null) || hasWebhook !== provider.webhook.events.includes('ProviderWebhookReceived')) throw new Error('PROVIDER_WEBHOOK_INVALID:' + provider.id);
  if ((provider.id === 'supplier' && provider.secretRefs.length !== 0) || (provider.id !== 'supplier' && stableJson(provider.secretRefs) !== '["credential"]')) throw new Error('PROVIDER_SECRET_REFERENCE_INVALID:' + provider.id);
}

const target = resolve(root, 'services/commerce/src/modules/extension/infrastructure/loader/ProviderCatalog.ts');
const content = [
  '// Generated by @shop/providergen for the Extension Module. Do not edit.',
  "import type { ProviderFactory } from '@shop/providercore';",
  ...providers.map((provider) => `import { ${provider.factory} } from '${provider.package}';`),
  '',
  'const FACTORY_BY_ID: Readonly<Record<string, ProviderFactory>> = Object.freeze({',
  ...providers.map((provider) => `  ${provider.id}: ${provider.factory},`),
  '});',
  '',
  'export const PROVIDER_FACTORIES: readonly ProviderFactory[] = Object.freeze(Object.values(FACTORY_BY_ID));',
  '',
  'export function providerFactory(id: string): ProviderFactory {',
  '  const factory = FACTORY_BY_ID[id];',
  '  if (!factory) throw new Error(`PROVIDER_FACTORY_MISSING:${id}`);',
  '  return factory;',
  '}',
  '',
].join('\n');

const uiTarget = resolve(root, 'packages/contract/src/provider/ProviderUiCatalog.ts');
const uiContent = [
  '// Generated by @shop/providergen from each extension Catalog.ts. Do not edit.',
  "export type ProviderClient = 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';",
  "export type ProviderConfigFieldKind = 'text' | 'url' | 'secretref' | 'endpoint';",
  "export interface ProviderConfigField { readonly key: string; readonly label: string; readonly kind: ProviderConfigFieldKind; readonly required: boolean; readonly initial: string; readonly placeholder: string; readonly help: string; readonly operation?: string; }",
  "export interface ProviderConfigForm { readonly schema: string; readonly healthOperation: string; readonly secretRefs: readonly string[]; readonly fields: readonly ProviderConfigField[]; }",
  "export interface ProviderUiCatalog { readonly id: string; readonly name: string; readonly business: string; readonly clients: readonly ProviderClient[]; readonly settings: readonly string[]; readonly help: string; readonly transport: 'endpoint' | 'local'; readonly capabilities: readonly string[]; readonly form: ProviderConfigForm; }",
  `export const PROVIDER_UI_CATALOGS: readonly ProviderUiCatalog[] = Object.freeze(${JSON.stringify(uiCatalogs, null, 2)});`,
  'const CATALOG_BY_ID: Readonly<Record<string, ProviderUiCatalog>> = Object.freeze(Object.fromEntries(PROVIDER_UI_CATALOGS.map((catalog) => [catalog.id, catalog])));',
  'export function providerUiCatalog(id: string): ProviderUiCatalog { const catalog = CATALOG_BY_ID[id]; if (!catalog) throw new Error(`PROVIDER_UI_CATALOG_MISSING:${id}`); return catalog; }',
  '',
].join('\n');

function providerForm(provider: ProviderRecord, operations: readonly string[]): ProviderUiForm {
  const fields: ProviderUiField[] = [field('region', '部署区域', 'text', true, 'cn', '例如：cn-east-1', '用于区域路由、数据驻留和同步水位隔离。')];
  if (provider.sandbox.mode === 'endpoint') {
    fields.push(field('baseUrl', '服务地址', 'url', true, '', 'https://provider.example.com', '仅允许 HTTPS 地址，不得包含账号、口令、查询参数或片段。'));
    fields.push(field('secretRef', '密钥引用', 'secretref', true, '', 'secret/channel/credential', `引用密钥管理系统中包含 ${provider.secretRefs.join('、')} 的安全条目；明文不会进入浏览器。`));
    const endpoints = [...new Set([provider.health.operation, ...operations])];
    fields.push(...endpoints.map((operation) => Object.freeze({
      ...field(`endpoint.${operation}`, endpointLabel(operation), 'endpoint', true, '', `/${operation.replaceAll('.', '/')}`, '填写该能力在服务商侧的相对路径；不得包含域名、查询参数或密钥。'),
      operation,
    })));
  }
  return Object.freeze({ schema: provider.configSchema, healthOperation: provider.health.operation, secretRefs: Object.freeze([...provider.secretRefs]), fields: Object.freeze(fields) });
}

function field(key: string, label: string, kind: ProviderUiField['kind'], required: boolean, initial: string, placeholder: string, help: string): ProviderUiField {
  return Object.freeze({ key, label, kind, required, initial, placeholder, help });
}

function endpointLabel(operation: string): string {
  const terms: Readonly<Record<string, string>> = Object.freeze({
    health: '健康检查', catalog: '商品目录', product: '商品', price: '价格', inventory: '库存', stock: '库存', order: '订单', cancel: '取消', logistics: '物流', delivery: '配送', shipment: '发货', return: '退货', refund: '退款', statement: '账单', slot: '时段', redeem: '核销', verify: '核验', issue: '发放', void: '作废', query: '查询', show: '场次', seat: '座位', menu: '菜单', pickup: '取餐', submit: '提交', authorize: '授权', pull: '拉取', fresh: '生鲜', flower: '鲜花', book: '图书', cake: '蛋糕', charge: '充值', voucher: '电子券', movie: '电影', meal: '餐饮',
  });
  const words = operation.split('.').map((term) => terms[term] ?? term).join(' · ');
  return `接口：${words}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value as Readonly<Record<string, unknown>>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`;
  return JSON.stringify(value);
}

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== content) throw new Error('GENERATED_PROVIDER_REGISTRY_DRIFT:' + target);
  const currentUi = await readFile(uiTarget, 'utf8').catch(() => '');
  if (currentUi !== uiContent) throw new Error('GENERATED_PROVIDER_UI_CATALOG_DRIFT:' + uiTarget);
} else {
  await writeFile(target, content, 'utf8');
  await writeFile(uiTarget, uiContent, 'utf8');
}
