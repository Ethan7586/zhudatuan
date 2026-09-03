import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import { buildOpenapi, identityClientSchemaSource, operationSource, schemaSource, sdkDomainSources, sdkSource, stable, type OperationDefinition } from './ClientArtifacts';

interface EventDefinition {
  readonly id: string;
  readonly owner: string;
  readonly version: number;
  readonly schema: string;
  readonly handlers: readonly string[];
  readonly payload: Readonly<Record<string, EventFieldType>>;
}
type EventScalarType =
  | 'id'
  | 'string'
  | 'currency'
  | 'iso8601utc'
  | 'integer'
  | 'positiveinteger'
  | 'boolean'
  | 'jsonobject'
  | 'jsonarray'
  | 'idarray'
  | 'stringarray'
  | 'reservationlines'
  | 'ordertenders'
  | 'orderlines'
  | 'ordersnapshot'
  | 'refundtenders'
  | 'statementsnapshot'
  | 'providerevidence'
  | 'recoveryevidence'
  | 'orderexportfilter'
  | 'financeexportfilter'
  | 'authorizationsnapshot';
type EventFieldType = EventScalarType | `optional${EventScalarType}` | `nullable${EventScalarType}`;
interface CapabilityDefinition {
  readonly code: string;
  readonly kind: string;
  readonly audience?: OperationDefinition['audience'];
}
interface ErrorDefinition {
  readonly code: string;
  readonly owner: string;
  readonly category: 'authentication' | 'authorization' | 'validation' | 'conflict' | 'rate' | 'dependency' | 'internal' | 'notfound';
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfter: boolean;
  readonly audit: boolean;
  readonly exposure: 'message' | 'generic' | 'hidden';
  readonly action: 'retry' | 'signin' | 'stepup' | 'refresh' | 'contact' | 'none';
  readonly messageKey: string;
  readonly details: readonly string[];
  readonly reserved: boolean;
  readonly message: string;
  readonly english: string;
}
interface LocalErrorDefinition {
  readonly code: string;
  readonly owner: string;
  readonly category: ErrorDefinition['category'];
  readonly retryable: boolean;
  readonly retryAfter: boolean;
  readonly exposure: ErrorDefinition['exposure'];
  readonly action: ErrorDefinition['action'];
  readonly messageKey: string;
  readonly message: string;
  readonly english: string;
}
interface ErrorCatalogDefinition {
  readonly api: readonly ErrorDefinition[];
  readonly transport: readonly LocalErrorDefinition[];
  readonly client: readonly LocalErrorDefinition[];
}
interface PermissionDefinition {
  readonly code: string;
  readonly module: string;
  readonly category: string;
  readonly risk: 'low' | 'elevated' | 'high' | 'critical';
  readonly minimumAssurance: 1 | 2 | 3;
  readonly delegatable: boolean;
  readonly allowedScopeKinds: readonly string[];
  readonly makerChecker: boolean;
  readonly description: string;
}

const root = resolve(import.meta.dirname, '../../..');
const definitions = resolve(root, 'packages/contract/definitions');
const authority = parse(await readFile(resolve(root, 'config/authorities.yml'), 'utf8')) as Readonly<{ contract?: Readonly<{ version?: unknown }> }>;
const contractVersion = authorityVersion(authority.contract?.version);
const operations = (await catalog<OperationDefinition>('operations.yml', 'operations', 3)).map(withBoundaryErrors);
const events = await catalog<EventDefinition>('events.yml', 'events', 3);
const capabilities = await catalog<CapabilityDefinition>('capabilities.yml', 'capabilities', 3);
const errorCatalog = await readErrorCatalog();
const errors = errorCatalog.api;
const permissions = await catalog<PermissionDefinition>('permissions.yml', 'permissions', 3);
validateOperations(operations);
validateEvents(events);
validatePermissions(operations, permissions);
validateCapabilityAudiences(operations, capabilities);
validateErrors(errorCatalog);
const check = process.argv.includes('--check');
const openapi = buildOpenapi(operations, new Map(errors.map(({ code, status }) => [code, status])), contractVersion);
const eventArtifact = stable({ version: 3, events: events.map((item) => ({ type: item.id, version: item.version, module: item.owner, schema: item.schema, payload: item.payload })) });
const permissionArtifact = permissions;
const errorArtifact = errorCatalog;
const contractChecksum = hash(JSON.stringify({ openapi, events: eventArtifact, permissions: permissionArtifact, errors: errorArtifact }));

await emit(resolve(root, 'packages/contract/openapi.json'), `${JSON.stringify(openapi, null, 2)}\n`);
await emit(resolve(root, 'packages/contract/events.json'), `${JSON.stringify(eventArtifact, null, 2)}\n`);
await emit(resolve(root, 'packages/contract/src/operations/CommerceCatalog.ts'), operationSource(operations));
await emit(resolve(root, 'packages/contract/src/operations/CommerceSchemas.ts'), schemaSource(operations));
await emit(resolve(root, 'packages/contract/src/operations/IdentityClientSchemas.ts'), identityClientSchemaSource(operations));
await emit(resolve(root, 'packages/contract/src/events/CommerceEvents.ts'), eventSource(events));
await emit(resolve(root, 'packages/contract/src/EventSerializer.ts'), eventSerializerSource(events));
await emit(resolve(root, 'packages/contract/src/ContractIdentity.ts'), contractIdentitySource(contractChecksum, contractVersion));
await emit(resolve(root, 'packages/contract/src/ErrorContract.ts'), errorSource(errorCatalog));
await emit(resolve(root, 'packages/presentation/src/generated/ErrorPolicy.ts'), errorPolicySource(errorCatalog));
await emit(resolve(root, 'packages/authz/src/PermissionCatalog.ts'), permissionSource(permissions));
await emit(resolve(root, 'packages/sdk/src/operations/CommerceClient.ts'), sdkSource(operations));
for (const [domain, source] of sdkDomainSources(operations)) await emit(resolve(root, `packages/sdk/src/operations/${domain}.ts`), source);
await emit(resolve(root, 'services/commerce/src/foundation/interface/OperationController.ts'), operationControllerSource(operations));
await emitRuntimeContract(contractChecksum);

async function catalog<T>(name: string, key: string, version: number): Promise<readonly T[]> {
  const payload = parse(await readFile(resolve(definitions, name), 'utf8'), { merge: true }) as Record<string, unknown>;
  if (payload.version !== version) throw new Error(`CONTRACT_VERSION_INVALID:${name}:${String(payload.version)}`);
  const values = payload[key];
  if (!Array.isArray(values)) throw new Error(`CONTRACT_DEFINITION_INVALID:${name}:${key}`);
  return values as readonly T[];
}

async function readErrorCatalog(): Promise<ErrorCatalogDefinition> {
  const payload = parse(await readFile(resolve(definitions, 'errors.yml'), 'utf8'), { merge: true }) as Record<string, unknown>;
  if (payload.version !== 4 || !Array.isArray(payload.api) || !Array.isArray(payload.transport) || !Array.isArray(payload.client)) {
    throw new Error('CONTRACT_DEFINITION_INVALID:errors.yml');
  }
  return {
    api: payload.api as readonly ErrorDefinition[],
    transport: payload.transport as readonly LocalErrorDefinition[],
    client: payload.client as readonly LocalErrorDefinition[],
  };
}

function withBoundaryErrors(operation: OperationDefinition): OperationDefinition {
  const codes = new Set(operation.errorUnion);
  codes.add('DEADLINE_EXCEEDED');
  codes.add('URL_SENSITIVE_DATA_FORBIDDEN');
  if (operation.method !== 'GET') {
    codes.add('CONTENT_TYPE_UNSUPPORTED');
    codes.add('REQUEST_BODY_TOO_LARGE');
    codes.add('REQUEST_JSON_INVALID');
  }
  codes.add('AUTHORIZATION_DENIED');
  if (operation.originPolicy === 'sameorigin') codes.add('ORIGIN_REQUIRED');
  if (operation.csrfPolicy === 'required') codes.add('CSRF_TOKEN_INVALID');
  if (['optional', 'session', 'mfa', 'stepup'].includes(operation.assuranceLevel)) codes.add('PERMISSION_DENIED');
  if (operation.idempotencyPolicy === 'required') {
    codes.add('IDEMPOTENCY_CONFLICT');
    codes.add('IDEMPOTENCY_KEY_REQUIRED');
  }
  if (operation.expectedVersion === 'required') {
    codes.add('EXPECTED_VERSION_INVALID');
    codes.add('EXPECTED_VERSION_REQUIRED');
  }
  return Object.freeze({ ...operation, errorUnion: Object.freeze([...codes].sort()) });
}

function validateOperations(values: readonly OperationDefinition[]): void {
  const ids = new Set<string>();
  const routes = new Set<string>();
  const required = [
    'id',
    'owner',
    'method',
    'path',
    'audience',
    'targets',
    'permission',
    'capability',
    'scopeKinds',
    'assuranceLevel',
    'makerChecker',
    'originPolicy',
    'csrfPolicy',
    'responseMode',
    'cachePolicy',
    'targetPolicy',
    'idempotencyPolicy',
    'requestSchema',
    'responseSchema',
    'errorUnion',
    'idempotencyScope',
    'expectedVersion',
    'timeout',
    'rateClass',
    'risk',
    'resourceResolver',
    'resourceParameter',
    'idempotent',
    'requirements',
    'controller',
    'handler',
    'sdk',
  ] as const;
  for (const item of values) {
    for (const field of required) if (!(field in item)) throw new Error(`OPERATION_FIELD_MISSING:${item.id}:${field}`);
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(item.id) || ids.has(item.id)) throw new Error(`OPERATION_ID_INVALID:${item.id}`);
    const pathAllowed = item.path.startsWith('/api/v1/') || (item.id.startsWith('runtime.health.') && item.path.startsWith('/health/'));
    if (!pathAllowed || routes.has(`${item.method} ${item.path}`)) throw new Error(`OPERATION_ROUTE_INVALID:${item.id}`);
    if (item.capability !== item.id || !Array.isArray(item.scopeKinds) || !Array.isArray(item.errorUnion)) throw new Error(`OPERATION_POLICY_INVALID:${item.id}`);
    const expectedTargets = item.audience === 'public' ? ['console', 'storefront'] : item.audience === 'console' || item.audience === 'storefront' ? [item.audience] : [];
    if (!Array.isArray(item.targets) || JSON.stringify(item.targets) !== JSON.stringify(expectedTargets)) throw new Error(`OPERATION_TARGETS_INVALID:${item.id}`);
    const pathParameters = [...item.path.matchAll(/\{([a-z][a-z0-9]*)\}/g)].map((match) => match[1]!);
    if (item.resourceResolver === 'none' ? item.resourceParameter !== null : item.resourceParameter !== null && !pathParameters.includes(item.resourceParameter)) throw new Error(`OPERATION_RESOURCE_PARAMETER_INVALID:${item.id}`);
    if (!Number.isInteger(item.timeout) || item.timeout < 1) throw new Error(`OPERATION_TIMEOUT_INVALID:${item.id}`);
    if (item.csrfPolicy === 'required' && (item.method === 'GET' || item.originPolicy !== 'sameorigin')) throw new Error(`OPERATION_CSRF_POLICY_INVALID:${item.id}`);
    if (item.idempotencyPolicy === 'required' && item.idempotencyScope === 'none') throw new Error(`OPERATION_IDEMPOTENCY_POLICY_INVALID:${item.id}`);
    if (['optional', 'session', 'mfa', 'stepup'].includes(item.assuranceLevel) && !item.errorUnion.includes('PERMISSION_DENIED')) throw new Error(`OPERATION_PERMISSION_ERROR_MISSING:${item.id}`);
    if (
      item.makerChecker &&
      (item.method === 'GET' ||
        item.permission === null ||
        item.assuranceLevel !== 'stepup' ||
        item.expectedVersion !== 'required' ||
        item.idempotencyScope === 'none' ||
        item.idempotencyPolicy !== 'required' ||
        item.originPolicy !== 'sameorigin' ||
        item.csrfPolicy !== 'required' ||
        item.targetPolicy !== 'exact' ||
        item.targets.length !== 1 ||
        item.targets[0] !== 'console' ||
        !['ACTION_PROOF_INVALID', 'ACTION_PROOF_REPLAYED', 'ACTION_PROOF_REQUIRED', 'MAKER_CHECKER_SEPARATION_REQUIRED'].every((code) => item.errorUnion.includes(code)))
    )
      throw new Error(`OPERATION_MAKER_CHECKER_POLICY_INVALID:${item.id}`);
    if (item.cachePolicy === 'etag' && item.method !== 'GET') throw new Error(`OPERATION_CACHE_POLICY_INVALID:${item.id}`);
    if (item.responseMode === 'redirect' && item.audience !== 'public') throw new Error(`OPERATION_REDIRECT_POLICY_INVALID:${item.id}`);
    if (item.requirements.length === 0 || item.requirements.some((id) => !/^MVP[A-Z]+$/.test(id))) throw new Error(`OPERATION_REQUIREMENT_INVALID:${item.id}`);
    const domain = item.id.split('.')[0]!;
    if (item.sdk !== `packages/sdk/src/operations/${domain}.ts`) throw new Error(`OPERATION_SDK_TARGET_INVALID:${item.id}`);
    ids.add(item.id);
    routes.add(`${item.method} ${item.path}`);
  }
}

function validateEvents(values: readonly EventDefinition[]): void {
  const ids = new Set<string>();
  const fieldTypes = new Set<EventScalarType>([
    'id',
    'string',
    'currency',
    'iso8601utc',
    'integer',
    'positiveinteger',
    'boolean',
    'jsonobject',
    'jsonarray',
    'idarray',
    'stringarray',
    'reservationlines',
    'ordertenders',
    'orderlines',
    'ordersnapshot',
    'refundtenders',
    'statementsnapshot',
    'providerevidence',
    'recoveryevidence',
    'orderexportfilter',
    'financeexportfilter',
    'authorizationsnapshot',
  ]);
  for (const item of values) {
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(item.id) || ids.has(item.id) || !Number.isSafeInteger(item.version) || item.version < 1 || !item.schema) {
      throw new Error(`EVENT_DEFINITION_INVALID:${item.id}`);
    }
    ids.add(item.id);
    if (item.payload === undefined || Object.keys(item.payload).length === 0) throw new Error(`EVENT_PAYLOAD_SCHEMA_MISSING:${item.id}`);
    for (const [field, specification] of Object.entries(item.payload)) {
      const scalar = specification.replace(/^(optional|nullable)/, '') as EventScalarType;
      if (!/^[a-z][a-zA-Z0-9]*$/.test(field) || !fieldTypes.has(scalar)) throw new Error(`EVENT_PAYLOAD_FIELD_INVALID:${item.id}:${field}:${specification}`);
    }
  }
}

function validatePermissions(values: readonly OperationDefinition[], definitions: readonly PermissionDefinition[]): void {
  const known = new Set<string>();
  let previous = '';
  for (const permission of definitions) {
    if (
      !/^[a-z]+(?:\.[a-z]+)+$/.test(permission.code) ||
      known.has(permission.code) ||
      permission.code.localeCompare(previous) <= 0 ||
      permission.module !== permission.category ||
      ![1, 2, 3].includes(permission.minimumAssurance) ||
      permission.allowedScopeKinds.length === 0
    ) {
      throw new Error(`PERMISSION_DEFINITION_INVALID:${permission.code}`);
    }
    known.add(permission.code);
    previous = permission.code;
  }
  for (const operation of values)
    if (operation.permission !== null && !known.has(operation.permission)) {
      throw new Error(`OPERATION_PERMISSION_UNKNOWN:${operation.id}:${operation.permission}`);
    }
  for (const operation of values) {
    if (operation.permission === null) continue;
    const permission = definitions.find(({ code }) => code === operation.permission)!;
    if (operation.makerChecker && !permission.makerChecker) throw new Error(`OPERATION_PERMISSION_MAKER_CHECKER_MISMATCH:${operation.id}:${permission.code}`);
  }
}

function validateCapabilityAudiences(values: readonly OperationDefinition[], definitions: readonly CapabilityDefinition[]): void {
  const operationsById = new Map(values.map((operation) => [operation.id, operation]));
  for (const capability of definitions) {
    if (capability.kind !== 'operation') continue;
    const operation = operationsById.get(capability.code);
    if (operation === undefined) throw new Error(`CAPABILITY_OPERATION_MISSING:${capability.code}`);
    if (capability.audience !== operation.audience) throw new Error(`OPERATION_AUDIENCE_DRIFT:${operation.id}`);
  }
  for (const operation of values)
    if (!definitions.some(({ kind, code }) => kind === 'operation' && code === operation.id)) {
      throw new Error(`OPERATION_CAPABILITY_MISSING:${operation.id}`);
    }
}

function validateErrors(catalog: ErrorCatalogDefinition): void {
  const allCodes = new Set<string>();
  for (const [kind, values] of Object.entries(catalog) as readonly [keyof ErrorCatalogDefinition, readonly (ErrorDefinition | LocalErrorDefinition)[]][]) {
    let previous = '';
    for (const error of values) {
      if (!/^[A-Z][A-Z0-9_]{2,}$/.test(error.code) || allCodes.has(error.code)) throw new Error(`ERROR_CODE_INVALID:${error.code}`);
      if (kind === 'api' && (!Number.isSafeInteger((error as ErrorDefinition).status) || (error as ErrorDefinition).status < 400 || (error as ErrorDefinition).status > 599)) {
        throw new Error(`ERROR_STATUS_INVALID:${error.code}`);
      }
      if (
        typeof error.owner !== 'string' ||
        error.owner.length === 0 ||
        !['authentication', 'authorization', 'validation', 'conflict', 'rate', 'dependency', 'internal', 'notfound'].includes(error.category) ||
        typeof error.retryable !== 'boolean' ||
        typeof error.retryAfter !== 'boolean' ||
        !['message', 'generic', 'hidden'].includes(error.exposure) ||
        !['retry', 'signin', 'stepup', 'refresh', 'contact', 'none'].includes(error.action) ||
        typeof error.messageKey !== 'string' ||
        !/^error\.[a-z0-9_]+$/.test(error.messageKey) ||
        typeof error.message !== 'string' ||
        error.message.length === 0 ||
        typeof error.english !== 'string' ||
        error.english.length === 0 ||
        (kind === 'api' && (typeof (error as ErrorDefinition).audit !== 'boolean' || !Array.isArray((error as ErrorDefinition).details) || typeof (error as ErrorDefinition).reserved !== 'boolean'))
      )
        throw new Error(`ERROR_POLICY_INVALID:${error.code}`);
      if (error.retryAfter && !error.retryable) throw new Error(`ERROR_RETRY_AFTER_INVALID:${error.code}`);
      if (error.code.localeCompare(previous) <= 0) throw new Error(`ERROR_CATALOG_NOT_SORTED:${error.code}`);
      allCodes.add(error.code);
      previous = error.code;
    }
  }
  const apiCodes = new Set(catalog.api.map(({ code }) => code));
  for (const operation of operations) for (const code of operation.errorUnion) if (!apiCodes.has(code)) throw new Error(`OPERATION_ERROR_UNKNOWN:${operation.id}:${code}`);
}

async function emit(path: string, content: string): Promise<void> {
  if (!check) {
    await mkdir(dirname(path), { recursive: true });
    return writeFile(path, content, 'utf8');
  }
  const current = await readFile(path, 'utf8').catch(() => '');
  if (current !== content) throw new Error(`GENERATED_CONTRACT_DRIFT:${path}`);
}

async function emitRuntimeContract(contractChecksum: string): Promise<void> {
  await emit(resolve(root, 'services/commerce/src/generated/EventSubscriptions.ts'), eventRegistrySource(events));
  await emit(resolve(root, 'services/commerce/src/app/events.ts'), eventAppSource(events));
  const template = await readFile(resolve(root, 'database/contracts/publish.template.sql'), 'utf8');
  const operationRows = operations.map((item) => sqlRow([item.id, item.owner, item.method, item.path, contractVersion])).join(',\n');
  const eventRows = events.map((item) => sqlRow([item.id, item.version, item.owner, item.schema])).join(',\n');
  const capabilityRows = operations.map((item) => sqlRow([item.id, 'operation', item.id, 3, 'active'])).join(',\n');
  const bindings = operations.map((item) => sqlRow([item.id, item.id, item.permission, item.audience])).join(',\n');
  const used = new Set(operations.flatMap((item) => (item.permission === null ? [] : [item.permission])));
  const permissionRows = permissions
    .filter(({ code }) => used.has(code))
    .sort((left, right) => left.code.localeCompare(right.code))
    .map(({ code, risk }) => sqlRow([`permission:${hash(code).slice(0, 24)}`, code, risk, 'active']))
    .join(',\n');
  await emit(
    resolve(root, 'database/contracts/current.sql'),
    template
      .replace('{{OPERATIONS}}', operationRows)
      .replace('{{EVENTS}}', eventRows)
      .replace('{{CAPABILITIES}}', capabilityRows)
      .replace('{{OPERATIONCAPABILITIES}}', bindings)
      .replace('{{PERMISSIONS}}', permissionRows)
      .replace('{{CONTRACTCHECKSUM}}', contractChecksum)
  );
}

function permissionSource(values: readonly PermissionDefinition[]): string {
  return `// Generated from packages/contract/definitions/permissions.yml. Do not edit.\nimport type { PermissionDefinition } from './Permission';\n\nexport const PERMISSION_CATALOG = Object.freeze(${JSON.stringify(values, null, 2)} as const satisfies readonly PermissionDefinition[]);\nconst byCode: ReadonlyMap<string, PermissionDefinition> = new Map(PERMISSION_CATALOG.map((permission) => [permission.code, permission]));\nexport function permissionDefinition(code: string): PermissionDefinition { const permission=byCode.get(code); if(!permission) throw new Error('PERMISSION_UNKNOWN'); return permission; }\n`;
}

function errorSource(catalog: ErrorCatalogDefinition): string {
  const rows = catalog.api.map((value) => `  ${JSON.stringify(value)},`).join('\n');
  const apiCodes = JSON.stringify(catalog.api.map(({ code }) => code));
  const transportCodes = JSON.stringify(catalog.transport.map(({ code }) => code));
  const clientCodes = JSON.stringify(catalog.client.map(({ code }) => code));
  return `// Generated from definitions/errors.yml. Do not edit.\nexport const API_ERROR_CATALOG = Object.freeze([\n${rows}\n] as const);\nexport const API_ERROR_CODES = ${apiCodes} as const;\nexport const TRANSPORT_ERROR_CODES = ${transportCodes} as const;\nexport const CLIENT_ERROR_CODES = ${clientCodes} as const;\nexport type ApiErrorCode = (typeof API_ERROR_CODES)[number];\nexport type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[number];\nexport type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];\nexport type FailureCode = Readonly<{ kind: 'api'; code: ApiErrorCode }> | Readonly<{ kind: 'transport'; code: TransportErrorCode }> | Readonly<{ kind: 'client'; code: ClientErrorCode }>;\nconst byCode: ReadonlyMap<string, (typeof API_ERROR_CATALOG)[number]> = new Map(API_ERROR_CATALOG.map((item) => [item.code, item]));\nexport function errorDefinition(code: string): (typeof API_ERROR_CATALOG)[number] | undefined { return byCode.get(code); }\nexport function errorStatus(code: ApiErrorCode): number { return byCode.get(code)!.status; }\n`;
}

function errorPolicySource(catalog: ErrorCatalogDefinition): string {
  const rows = (kind: keyof ErrorCatalogDefinition) => catalog[kind].map((value) => `  ${JSON.stringify(value.code)}: ${JSON.stringify({ ...value, kind })},`).join('\n');
  return `// Generated from packages/contract/definitions/errors.yml. Do not edit.\nexport const ERROR_POLICY = Object.freeze({\n${rows('api')}\n${rows('transport')}\n${rows('client')}\n} as const);\nexport type ErrorPolicyCode = keyof typeof ERROR_POLICY;\nexport function errorPolicy(code: string): (typeof ERROR_POLICY)[ErrorPolicyCode] | undefined { return ERROR_POLICY[code as ErrorPolicyCode]; }\n`;
}

function eventSource(values: readonly EventDefinition[]): string {
  const rows = values.map((item) => `  eventContract(${JSON.stringify({ type: item.id, version: item.version, module: item.owner })}),`).join('\n');
  return `// Generated from definitions/events.yml. Do not edit.\nimport { eventContract } from '../EventContract';\nexport const COMMERCE_EVENTS = Object.freeze([\n${rows}\n] as const);\n`;
}

function eventSerializerSource(values: readonly EventDefinition[]): string {
  const rows = values
    .map(
      (item) =>
        `  ${JSON.stringify(item.id)}: z.strictObject({ ${Object.entries(item.payload)
          .map(([field, type]) => `${JSON.stringify(field)}: ${eventFieldSchema(type)}`)
          .join(', ')} }),`
    )
    .join('\n');
  return `// Generated from definitions/events.yml. Do not edit.\nimport { z } from 'zod';\n\nconst EventIdSchema = z.string().trim().min(1).max(255);\nconst MoneySchema = z.number().int().safe();\nconst CurrencySchema = z.string().regex(/^[A-Z]{3}$/);\nconst TimeSchema = z.iso.datetime({ offset: true });\nconst OrderTenderSchema = z.strictObject({ kind: z.enum(['benefit','voucher','wechat']), reference: EventIdSchema.nullable(), amountMinor: MoneySchema });\nconst OrderLineSchema = z.strictObject({ line: EventIdSchema, sku: EventIdSchema, product: EventIdSchema, category: EventIdSchema, powderclass: EventIdSchema, provider: EventIdSchema.nullable(), partner: EventIdSchema.nullable(), totalMinor: MoneySchema, discountMinor: MoneySchema, payableMinor: MoneySchema });\nconst OrderSnapshotSchema = z.strictObject({ order: EventIdSchema, number: z.string().min(1).max(255), member: EventIdSchema, mall: EventIdSchema, application: EventIdSchema, scopes: z.array(EventIdSchema), timezone: z.string().min(1).max(255), totalMinor: MoneySchema, currency: CurrencySchema, evidenceHash: z.string().min(1).max(255), tenders: z.array(OrderTenderSchema), lines: z.array(OrderLineSchema) });\nconst ReservationLineSchema = z.strictObject({ sku: EventIdSchema, stockitem: EventIdSchema.nullable(), quantity: z.number().int().positive().safe() });\nconst RefundTenderSchema = z.strictObject({ sequence: z.number().int().positive().safe(), kind: z.enum(['wechat','benefit','voucher']), reference_id: EventIdSchema.nullable(), amount_minor: MoneySchema });\nconst StatementSnapshotSchema = z.strictObject({ statement: EventIdSchema, periodStart: z.string().min(1).max(32), periodEnd: z.string().min(1).max(32), currency: CurrencySchema, openingMinor: MoneySchema, debitMinor: MoneySchema, creditMinor: MoneySchema, closingMinor: MoneySchema, state: z.string().min(1).max(64) });\nconst PaymentEvidenceSchema = z.strictObject({ notificationId: EventIdSchema, eventType: z.literal('TRANSACTION.SUCCESS'), createTime: TimeSchema, resourceType: z.literal('encrypt-resource'), transactionId: EventIdSchema, outTradeNo: EventIdSchema, tradeState: z.literal('SUCCESS'), successTime: TimeSchema, totalCents: MoneySchema, currency: z.literal('CNY') });\nconst RefundEvidenceSchema = z.strictObject({ notificationId: EventIdSchema, eventType: z.enum(['REFUND.SUCCESS','REFUND.ABNORMAL','REFUND.CLOSED']), createTime: TimeSchema, resourceType: z.literal('encrypt-resource'), mchId: EventIdSchema, refundId: EventIdSchema, outRefundNo: EventIdSchema, transactionId: EventIdSchema, outTradeNo: EventIdSchema, refundStatus: z.enum(['SUCCESS','ABNORMAL','CLOSED']), successTime: TimeSchema.nullable(), refundCents: MoneySchema, totalCents: MoneySchema, payerRefundCents: MoneySchema, payerTotalCents: MoneySchema });\nconst ProviderEvidenceSchema = z.union([PaymentEvidenceSchema, RefundEvidenceSchema]);\nconst RecoveryEvidenceSchema = z.union([z.strictObject({ intent: EventIdSchema, order: EventIdSchema, providerState: z.string().min(1).max(64), amountMinor: MoneySchema, transaction: EventIdSchema.nullable(), detectedAt: TimeSchema }),z.strictObject({ deadletter: EventIdSchema, job: EventIdSchema, kind: z.string().min(1).max(64), payload: z.record(z.string(), z.unknown()), error: z.string().min(1).max(255) })]);\nconst OrderExportFilterSchema = z.strictObject({ order: EventIdSchema.optional(), placed: TimeSchema.optional(), lifecycle: z.string().max(64).optional(), payment: z.string().max(64).optional(), fulfillment: z.string().max(64).optional(), mall: EventIdSchema.optional() });\nconst FinanceExportFilterSchema = z.strictObject({ periodStart: z.string().max(32).optional(), periodEnd: z.string().max(32).optional(), currency: CurrencySchema.optional(), state: z.enum(['draft','final']).optional() });\nconst AuthorizationSnapshotSchema = z.strictObject({ actor: EventIdSchema, membership: EventIdSchema, scope: EventIdSchema, trace: EventIdSchema });\nconst EventEnvelopeSchema = z.strictObject({ eventId: EventIdSchema, eventType: EventIdSchema, occurredAt: TimeSchema, aggregateId: EventIdSchema, aggregateVersion: z.number().int().positive().safe(), scopeId: EventIdSchema, actorId: EventIdSchema, correlationId: EventIdSchema, causationId: EventIdSchema, payloadVersion: z.number().int().positive().safe(), payload: z.record(z.string(), z.unknown()) });\nexport const EVENT_PAYLOAD_SCHEMAS = Object.freeze({\n${rows}\n});\nexport type EventType = keyof typeof EVENT_PAYLOAD_SCHEMAS;\nexport type EventPayload<TKey extends EventType> = z.infer<(typeof EVENT_PAYLOAD_SCHEMAS)[TKey]>;\nexport interface SerializedEvent<TKey extends EventType = EventType> { readonly eventId: string; readonly eventType: TKey; readonly occurredAt: string; readonly aggregateId: string; readonly aggregateVersion: number; readonly scopeId: string; readonly actorId: string; readonly correlationId: string; readonly causationId: string; readonly payloadVersion: number; readonly payload: EventPayload<TKey> }\nexport function parseEventPayload<TKey extends EventType>(type: TKey, payload: unknown): EventPayload<TKey>;\nexport function parseEventPayload(type: string, payload: unknown): Readonly<Record<string, unknown>>;\nexport function parseEventPayload(type: string, payload: unknown): Readonly<Record<string, unknown>> { const schema=EVENT_PAYLOAD_SCHEMAS[type as EventType]; if(schema===undefined) throw new Error(\`EVENT_SCHEMA_UNKNOWN:\${type}\`); return schema.parse(payload); }\nexport function serializeEvent<TKey extends EventType>(event: SerializedEvent<TKey>): SerializedEvent<TKey> { const payload=parseEventPayload(event.eventType,event.payload); const parsed=EventEnvelopeSchema.parse({ ...event, payload }); return Object.freeze({ ...parsed, eventType: event.eventType, payload: Object.freeze(payload) }) as SerializedEvent<TKey>; }\n`;
}

function eventFieldSchema(type: EventFieldType): string {
  const optional = type.startsWith('optional');
  const nullable = type.startsWith('nullable');
  const scalar = type.replace(/^(optional|nullable)/, '') as EventScalarType;
  const schemas: Readonly<Record<EventScalarType, string>> = {
    id: 'EventIdSchema',
    string: 'z.string().max(16384)',
    currency: 'z.string().regex(/^[A-Z]{3}$/)',
    iso8601utc: 'z.iso.datetime({ offset: true })',
    integer: 'z.number().int().safe()',
    positiveinteger: 'z.number().int().positive().safe()',
    boolean: 'z.boolean()',
    jsonobject: 'z.record(z.string(), z.unknown())',
    jsonarray: 'z.array(z.unknown())',
    idarray: 'z.array(EventIdSchema)',
    stringarray: 'z.array(z.string().max(16384))',
    reservationlines: 'z.array(ReservationLineSchema)',
    ordertenders: 'z.array(OrderTenderSchema)',
    orderlines: 'z.array(OrderLineSchema)',
    ordersnapshot: 'OrderSnapshotSchema',
    refundtenders: 'z.array(RefundTenderSchema)',
    statementsnapshot: 'StatementSnapshotSchema',
    providerevidence: 'ProviderEvidenceSchema',
    recoveryevidence: 'RecoveryEvidenceSchema',
    orderexportfilter: 'OrderExportFilterSchema',
    financeexportfilter: 'FinanceExportFilterSchema',
    authorizationsnapshot: 'AuthorizationSnapshotSchema',
  };
  const schema = schemas[scalar];
  if (schema === undefined) throw new Error(`EVENT_FIELD_TYPE_UNKNOWN:${type}`);
  return `${schema}${optional ? '.optional()' : nullable ? '.nullable()' : ''}`;
}

function contractIdentitySource(checksum: string, version: string): string {
  return `// Generated from canonical definitions. Do not edit.\nexport const CONTRACT_VERSION = ${JSON.stringify(version)} as const;\nexport const CONTRACT_CHECKSUM = '${checksum}' as const;\n`;
}

function eventRegistrySource(values: readonly EventDefinition[]): string {
  const subscriptions = new Map<string, string[]>();
  for (const event of values) {
    for (const handler of event.handlers) subscriptions.set(handler, [...(subscriptions.get(handler) ?? []), event.id]);
  }
  const fields = [...subscriptions]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([handler, events]) => `  ${JSON.stringify(handler)}: Object.freeze(${JSON.stringify(events)}),`)
    .join('\n');
  return `// Generated from packages/contract/definitions/events.yml. Do not edit.\nexport const EVENT_SUBSCRIPTIONS = Object.freeze({\n${fields}\n});\nexport const PROJECTION_EVENTS: ReadonlySet<string> = new Set(EVENT_SUBSCRIPTIONS.projection);\n`;
}

function eventAppSource(values: readonly EventDefinition[]): string {
  const types = values.map((item) => `  ${JSON.stringify(item.id)},`).join('\n');
  const versions = values.map((item) => `  [${JSON.stringify(item.id)}, ${item.version}],`).join('\n');
  return `// Generated from packages/contract/definitions/events.yml. Do not edit.\nexport const EVENT_SCHEMA_TYPES = Object.freeze([\n${types}\n] as const);\nconst versions: ReadonlyMap<string, number> = new Map([\n${versions}\n]);\nexport function eventVersion(type: string): number { const version=versions.get(type); if(version===undefined) throw new Error('EVENT_SCHEMA_UNKNOWN'); return version; }\n`;
}

function operationControllerSource(values: readonly OperationDefinition[]): string {
  const rows = values.map((item) => `  ${JSON.stringify(item.id)},`).join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '@shop/contract';\n\nexport const CONTROLLER_OPERATIONS = Object.freeze([\n${rows}\n] as const satisfies readonly OperationId[]);\nconst known: ReadonlySet<string> = new Set(CONTROLLER_OPERATIONS);\nexport function operationController(operation: string): OperationId {\n  if (!known.has(operation)) throw new Error(\`OPERATION_CONTROLLER_MISSING:\${operation}\`);\n  return operation as OperationId;\n}\n`;
}

function sqlRow(values: readonly (string | number | null)[]): string {
  return `  (${values.map((value) => (value === null ? 'null' : typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`)).join(',')})`;
}
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function authorityVersion(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) throw new Error('CONTRACT_AUTHORITY_VERSION_INVALID');
  return value;
}
