import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { PERMISSION_CATALOG } from '../../../packages/authz/src/PermissionCatalog';
import { buildOpenapi, operationSource, schemaSource, sdkDomainSources, sdkSource, type OperationDefinition } from './ClientArtifacts';

interface EventDefinition {
  readonly id: string;
  readonly owner: string;
  readonly version: number;
  readonly schema: string;
  readonly handlers: readonly string[];
}

interface CapabilityDefinition {
  readonly code: string;
  readonly kind: string;
  readonly audience?: OperationDefinition['audience'];
}

interface ErrorDefinition {
  readonly code: string;
  readonly status: number;
}

const root = resolve(import.meta.dirname, '../../..');
const definitions = resolve(root, 'packages/contract/definitions');
const operations = await catalog<OperationDefinition>('operations.yml', 'operations');
const events = await catalog<EventDefinition>('events.yml', 'events');
const capabilities = await catalog<CapabilityDefinition>('capabilities.yml', 'capabilities');
const errors = await catalog<ErrorDefinition>('errors.yml', 'errors');
validateOperations(operations);
validateEvents(events);
validatePermissions(operations);
validateCapabilityAudiences(operations, capabilities);
validateErrors(errors);
const check = process.argv.includes('--check');
const contractSdkOnly = process.argv.includes('--scope=contract-sdk');
const permissionMetadata = new Map(PERMISSION_CATALOG.map(({ code, risk, stepup, scopes }) => [code, { risk, stepup, scopes }]));
const openapi = buildOpenapi(operations, permissionMetadata);
const eventArtifact = stable({ version: 1, events: events.map((item) => ({ type: item.id, version: item.version, module: item.owner })) });
const permissionArtifact = PERMISSION_CATALOG.map(({ code, category, risk, stepup, scopes }) => ({ code, category, risk, stepup, scopes }));
const errorArtifact = errors.map(({ code, status }) => ({ code, status }));
// OMS links are design provenance; without a path/schema/permission change they do not rotate the published runtime identity.
const contractChecksum = hash(JSON.stringify({ openapi: contractIdentityOpenapi(openapi), events: eventArtifact, permissions: permissionArtifact, errors: errorArtifact }));

await emit(resolve(root, 'packages/contract/openapi.json'), `${JSON.stringify(openapi, null, 2)}\n`);
await emit(resolve(root, 'packages/contract/events.json'), `${JSON.stringify(eventArtifact, null, 2)}\n`);
await emit(resolve(root, 'packages/contract/src/operations/CommerceOperations.ts'), operationSource(operations, permissionMetadata));
await emit(resolve(root, 'packages/contract/src/operations/CommerceSchemas.ts'), schemaSource(operations));
await emit(resolve(root, 'packages/contract/src/events/CommerceEvents.ts'), eventSource(events));
await emit(resolve(root, 'packages/contract/src/EventSerializer.ts'), eventSerializerSource(events));
await emit(resolve(root, 'packages/contract/src/ContractIdentity.generated.ts'), contractIdentitySource(contractChecksum));
await emit(resolve(root, 'packages/contract/src/ErrorContract.generated.ts'), errorSource(errors));
await emit(resolve(root, 'packages/sdk/src/operations/CommerceClient.generated.ts'), sdkSource(operations));
for (const [domain, source] of sdkDomainSources(operations)) {
  await emit(resolve(root, `packages/sdk/src/operations/${domain}.ts`), source);
}
if (!contractSdkOnly) await emitLegacyArtifacts(contractChecksum);

async function catalog<T>(name: string, key: string): Promise<readonly T[]> {
  const payload = parse(await readFile(resolve(definitions, name), 'utf8')) as Record<string, unknown>;
  const values = payload[key];
  if (!Array.isArray(values)) throw new Error(`CONTRACT_DEFINITION_INVALID:${name}:${key}`);
  return values as readonly T[];
}

function validateOperations(values: readonly OperationDefinition[]): void {
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const item of values) {
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(item.id) || ids.has(item.id)) throw new Error(`OPERATION_ID_INVALID:${item.id}`);
    const pathAllowed = item.path.startsWith('/api/v1/') || item.id.startsWith('runtime.health.') && item.path.startsWith('/health/');
    if (!pathAllowed || routes.has(`${item.method} ${item.path}`)) throw new Error(`OPERATION_ROUTE_INVALID:${item.id}`);
    if (item.schema !== 'exact' && item.schema !== 'structural') throw new Error(`OPERATION_SCHEMA_INVALID:${item.id}`);
    if (item.requirements.length === 0 || item.requirements.some((id) => !/^(?:MVP(?:0[3-9]|1\d|2[0-3])|OMS-(?:00[1-9]|01[0-4]))$/.test(id))) {
      throw new Error(`OPERATION_REQUIREMENT_INVALID:${item.id}`);
    }
    const domain = item.id.split('.')[0]!;
    if (item.sdk !== `packages/sdk/src/operations/${domain}.ts`) throw new Error(`OPERATION_SDK_TARGET_INVALID:${item.id}`);
    ids.add(item.id);
    routes.add(`${item.method} ${item.path}`);
  }
}

function validateEvents(values: readonly EventDefinition[]): void {
  const ids = new Set<string>();
  for (const item of values) {
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(item.id) || ids.has(item.id) || !Number.isSafeInteger(item.version) || item.version < 1) throw new Error(`EVENT_DEFINITION_INVALID:${item.id}`);
    ids.add(item.id);
  }
}

function validatePermissions(values: readonly OperationDefinition[]): void {
  const definitions = new Set(PERMISSION_CATALOG.map(({ code }) => code));
  for (const operation of values) {
    if (operation.permission !== undefined && !definitions.has(operation.permission)) {
      throw new Error(`OPERATION_PERMISSION_UNKNOWN:${operation.id}:${operation.permission}`);
    }
  }
}

function validateCapabilityAudiences(values: readonly OperationDefinition[], capabilities: readonly CapabilityDefinition[]): void {
  const operations = new Map(values.map((operation) => [operation.id, operation]));
  for (const capability of capabilities) {
    if (capability.kind !== 'operation') continue;
    const operation = operations.get(capability.code);
    if (operation !== undefined && capability.audience !== operation.audience) {
      throw new Error(`OPERATION_AUDIENCE_DRIFT:${operation.id}:${operation.audience}:${capability.audience ?? 'missing'}`);
    }
  }
}

function validateErrors(values: readonly ErrorDefinition[]): void {
  const codes = new Set<string>();
  let previous = '';
  for (const error of values) {
    if (!/^[A-Z][A-Z0-9_]{2,}$/.test(error.code) || codes.has(error.code)) throw new Error(`ERROR_CODE_INVALID:${error.code}`);
    if (!Number.isSafeInteger(error.status) || error.status < 400 || error.status > 599) throw new Error(`ERROR_STATUS_INVALID:${error.code}`);
    if (error.code.localeCompare(previous) <= 0) throw new Error(`ERROR_CATALOG_NOT_SORTED:${error.code}`);
    codes.add(error.code);
    previous = error.code;
  }
}

async function emit(path: string, content: string): Promise<void> {
  if (!check) {
    await writeFile(path, content, 'utf8');
    return;
  }
  const current = await readFile(path, 'utf8').catch(() => '');
  if (current !== content) throw new Error(`GENERATED_CONTRACT_DRIFT:${path}`);
}

async function emitLegacyArtifacts(contractChecksum: string): Promise<void> {
  await emit(resolve(root, 'apps/miniapp/miniprogram/api/identity.js'), miniappIdentitySource(contractChecksum));
  await emit(resolve(root, 'apps/miniapp/miniprogram/api/operations.js'), miniappSource(operations, permissionMetadata));
  await emit(resolve(root, 'services/commerce/src/foundation/application/OperationHandler.ts'), hardenedHandlerSource(operations));
  await emit(resolve(root, 'services/commerce/src/foundation/interface/OperationController.ts'), hardenedControllerSource(operations));
  await emit(resolve(root, 'services/commerce/src/app/events.ts'), eventRegistrySource(events));

  const template = await readFile(resolve(root, 'database/contracts/publish.template.sql'), 'utf8');
  const operationRows = operations.map((item) => sqlRow([item.id, item.owner, item.method, item.path, '1.0.0'])).join(',\n');
  const eventRows = events.map((item) => sqlRow([item.id, item.version, item.owner, item.schema])).join(',\n');
  const capabilityRows = operations.map((item) => sqlRow([item.id, 'operation', item.id, 1, 'active'])).join(',\n');
  const bindings = operations.map((item) => sqlRow([item.id, item.id, item.permission ?? null, item.audience])).join(',\n');
  const usedPermissions = new Set(operations.flatMap((item) => item.permission ? [item.permission] : []));
  const permissions = PERMISSION_CATALOG.filter(({ code }) => usedPermissions.has(code))
    .sort((left, right) => left.code.localeCompare(right.code))
    .map(({ code, risk }) => sqlRow([`permission:${hash(code).slice(0, 24)}`, code, risk, 'active'])).join(',\n');
  const migration = template
    .replace('{{OPERATIONS}}', operationRows)
    .replace('{{EVENTS}}', eventRows)
    .replace('{{CAPABILITIES}}', capabilityRows)
    .replace('{{OPERATIONCAPABILITIES}}', bindings)
    .replace('{{PERMISSIONS}}', permissions)
    .replace('{{CONTRACTCHECKSUM}}', contractChecksum);
  await emit(resolve(root, 'database/contracts/current.sql'), migration);
}

function errorSource(values: readonly ErrorDefinition[]): string {
  const rows = values.map(({ code, status }) => `  ${JSON.stringify([code, status])},`).join('\n');
  return `// Generated from definitions/errors.yml. Do not edit.\nexport { ErrorContractSchema } from './ErrorSchema';\nexport type { ErrorContract } from './ErrorSchema';\n\nconst rows = [\n${rows}\n] as const;\n\nexport const ERROR_CODES = Object.freeze(rows.map(([code]) => code));\nexport type ErrorCode = (typeof rows)[number][0];\nconst statuses: ReadonlyMap<string, number> = new Map(rows);\nexport function errorStatus(code: string): number | undefined { return statuses.get(code); }\n`;
}

function eventSource(values: readonly EventDefinition[]): string {
  const rows = values.map((item) => `  eventContract(${JSON.stringify({ type: item.id, version: item.version, module: item.owner })}),`).join('\n');
  return `// Generated from definitions/events.yml. Do not edit.\nimport { eventContract } from '../EventContract';\n\nexport const COMMERCE_EVENTS = Object.freeze([\n${rows}\n] as const);\n`;
}

function eventSerializerSource(values: readonly EventDefinition[]): string {
  const ids = values.map((item) => `  '${item.id}',`).join('\n');
  return `// Generated from definitions/events.yml. Do not edit.\nimport type { EventContract } from './EventContract';\n\nexport const SERIALIZED_EVENT_TYPES = Object.freeze([\n${ids}\n] as const);\n\nexport interface SerializedEvent {\n  readonly type: string;\n  readonly version: number;\n  readonly module: string;\n  readonly payload: unknown;\n}\n\nexport function serializeEvent(contract: EventContract, payload: unknown): SerializedEvent {\n  return Object.freeze({ type: contract.type, version: contract.version, module: contract.module, payload });\n}\n`;
}

function contractIdentitySource(checksum: string): string {
  return [
    '// Generated from the canonical operation and event definitions. Do not edit.',
    "export const CONTRACT_VERSION = '1.0.0' as const;",
    "export const CONTRACT_CHECKSUM = '" + checksum + "' as const;",
    '',
  ].join('\n');
}

function miniappIdentitySource(checksum: string): string {
  return [
    '// Generated from the canonical operation and event definitions. Do not edit.',
    "module.exports = Object.freeze({ version: '1.0.0', checksum: '" + checksum + "' });",
    '',
  ].join('\n');
}

function eventRegistrySource(values: readonly EventDefinition[]): string {
  const ids = values.map((item) => `  '${item.id}',`).join('\n');
  const handlers = values.map((item) => `  [${JSON.stringify(item.id)}, Object.freeze(${JSON.stringify(item.handlers)})],`).join('\n');
  return `// Generated from packages/contract/definitions/events.yml. Do not edit.\nimport { COMMERCE_EVENTS } from '@shop/contract';\n\nexport const EVENT_SCHEMA_TYPES = Object.freeze([\n${ids}\n] as const);\n\nexport const EVENT_HANDLERS = new Map<string, readonly string[]>([\n${handlers}\n]);\n\nconst versions = new Map<string, number>(COMMERCE_EVENTS.map((event) => [event.type, event.version]));\n\nexport function eventVersion(type: string): number {\n  const version = versions.get(type);\n  if (version === undefined) throw new Error('EVENT_SCHEMA_UNKNOWN');\n  return version;\n}\n`;
}

function miniappSource(
  values: readonly OperationDefinition[],
  permissions: ReadonlyMap<string, Readonly<{ risk: string; stepup: boolean; scopes: readonly string[] }>>,
): string {
  const definitions = Object.fromEntries(values.map((item) => {
    const permission = item.permission === undefined ? undefined : permissions.get(item.permission);
    return [item.id, {
      method: item.method,
      path: item.path,
      audience: item.audience,
      idempotent: item.idempotent,
      idempotency: item.method === 'GET' || item.audience === 'provider' ? 'none' : 'required',
      expectedVersion: item.method === 'GET' ? 'none' : 'optional',
      risk: permission?.risk ?? 'low',
      stepup: permission?.stepup ?? false,
      scopeKinds: permission?.scopes ?? [],
      schema: item.schema,
    }];
  }));
  const groups = new Map<string, OperationDefinition[]>();
  for (const operation of values) {
    const domain = operation.id.split('.')[0]!;
    const current = groups.get(domain) ?? [];
    current.push(operation);
    groups.set(domain, current);
  }
  const clients = [...groups].map(([domain, operations]) => {
    const methods = operations.map((operation) => `    ${miniappMethodName(operation.id)}: bind(execute, ${JSON.stringify(operation.id)}),`).join('\n');
    return `  ${domain}: Object.freeze({\n${methods}\n  }),`;
  }).join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nconst definitions = Object.freeze(${JSON.stringify(definitions, null, 2)});\n\n/** @param {(id: string, input?: any, context?: any) => Promise<any>} execute */\nfunction createOperations(execute) {\n  if (typeof execute !== 'function') throw new Error('MINIAPP_OPERATION_EXECUTOR_REQUIRED');\n  return Object.freeze({\n${clients}\n  });\n}\n\n/** @param {(id: string, input?: any, context?: any) => Promise<any>} execute @param {string} id */\nfunction bind(execute, id) { return (input = {}, context = {}) => execute(id, input, context); }\n\nmodule.exports = Object.freeze({ createOperations, definitions });\n`;
}

function miniappMethodName(id: string): string {
  const [, ...segments] = id.split('.');
  return segments.map((segment, index) => index === 0 ? segment : `${segment[0]!.toUpperCase()}${segment.slice(1)}`).join('');
}

function handlerSource(values: readonly OperationDefinition[]): string {
  const ids = values.map((item) => `  '${item.id}',`).join('\n');
  return `// Generated shell from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '@shop/contract';\nimport type { AccessContext } from '../security/AccessContext';\nimport type { Handler } from './Handler';\n\nexport const HANDLED_OPERATION_IDS = Object.freeze([\n${ids}\n] as const satisfies readonly OperationId[]);\n\nexport interface OperationInput {\n  readonly path: Readonly<Record<string, string>>;\n  readonly query: Readonly<Record<string, string | readonly string[]>>;\n  readonly body: unknown;\n  readonly idempotency?: string;\n  readonly expectedVersion?: number;\n}\n\nexport interface OperationRequest {\n  readonly type: OperationId;\n  readonly input: OperationInput;\n  readonly access: AccessContext | null;\n}\n\nexport interface OperationResult {\n  readonly status: number;\n  readonly body?: unknown;\n  readonly headers?: Readonly<Record<string, string>>;\n}\n\nexport interface OperationUsecase {\n  invoke(request: OperationRequest): Promise<OperationResult>;\n}\n\nexport class OperationHandler implements Handler<OperationRequest, OperationResult> {\n  constructor(private readonly usecase: OperationUsecase) {}\n\n  handle(request: OperationRequest): Promise<OperationResult> {\n    return this.usecase.invoke(request);\n  }\n}\n`;
}

function controllerSource(values: readonly OperationDefinition[]): string {
  const ids = values.map((item) => `  '${item.id}',`).join('\n');
  return `// Generated shell from definitions/operations.yml. Do not edit.\nimport { OperationCatalog, type OperationId } from '@shop/contract';\nimport { token } from '../../bootstrap/Container';\nimport type { ModuleContext } from '../../bootstrap/ModuleRegistry';\nimport type { OperationHandler, OperationInput, OperationResult } from '../application/OperationHandler';\nimport type { AccessContext } from '../security/AccessContext';\nimport type { HttpRequest } from './HttpRequest';\nimport { json } from './HttpResponse';\n\nexport const CONTROLLER_OPERATION_IDS = Object.freeze([\n${ids}\n] as const satisfies readonly OperationId[]);\n\nexport interface OperationAuthorizer {\n  authorize(headers: Readonly<Record<string, string>>, operation: string, permission: string, resource?: string): Promise<AccessContext>;\n}\n\nexport const OPERATION_HANDLERS = token<Map<OperationId, OperationHandler>>('operation.handlers');\nexport const OPERATION_AUTHORIZER = token<OperationAuthorizer>('operation.authorizer');\n\nexport function registerOperationRoutes(module: string, context: ModuleContext): void {\n  const handlers = context.container.get(OPERATION_HANDLERS);\n  const authorizer = context.container.get(OPERATION_AUTHORIZER);\n  for (const operation of OperationCatalog.all().filter((candidate) => candidate.module === module)) {\n    const handler = handlers.get(operation.id);\n    if (!handler) throw new Error(\`OPERATION_HANDLER_MISSING:\${operation.id}\`);\n    context.routes.register({ operation: operation.id, handler: async (request) => {\n      const access = operation.audience === 'public' ? null : await authorizer.authorize(request.headers, operation.id, operation.permission ?? operation.id, Object.values(request.parameters)[0]);\n      const result: OperationResult = await handler.handle({ type: operation.id, input: operationInput(operation.method, request), access });\n      return json(result.status, result.body, result.headers);\n    } });\n  }\n}\n\nfunction operationInput(method: string, request: HttpRequest): OperationInput {\n  const idempotency = request.headers['idempotency-key'];\n  if (method !== 'GET' && idempotency === undefined) throw new Error('IDEMPOTENCY_KEY_REQUIRED');\n  const header = request.headers['if-match'];\n  const normalized = header?.replace(/^W\\/\"|\"$/g, '');\n  const expectedVersion = normalized === undefined ? undefined : Number(normalized);\n  if (normalized !== undefined && (!Number.isSafeInteger(expectedVersion) || expectedVersion! < 0)) throw new Error('EXPECTED_VERSION_INVALID');\n  return { path: request.parameters, query: queryObject(request.query), body: request.body,\n    ...(idempotency === undefined ? {} : { idempotency }), ...(expectedVersion === undefined ? {} : { expectedVersion }) };\n}\n\nfunction queryObject(parameters: URLSearchParams): Readonly<Record<string, string | readonly string[]>> {\n  const result: Record<string, string | readonly string[]> = {};\n  for (const key of new Set(parameters.keys())) {\n    const values = parameters.getAll(key);\n    result[key] = values.length === 1 ? values[0]! : Object.freeze(values);\n  }\n  return Object.freeze(result);\n}\n`;
}

function hardenedHandlerSource(values: readonly OperationDefinition[]): string {
  return handlerSource(values)
    .replace('  readonly query: Readonly<Record<string, string | readonly string[]>>;\n  readonly body: unknown;',
      '  readonly query: Readonly<Record<string, string | readonly string[]>>;\n  readonly headers: Readonly<Record<string, string>>;\n  readonly body: unknown;\n  readonly rawBody: string;\n  readonly deadline: number;\n  readonly signal: AbortSignal;');
}

function hardenedControllerSource(values: readonly OperationDefinition[]): string {
  return controllerSource(values)
    .replace("operation.audience === 'public' ? null", "operation.audience === 'public' || operation.audience === 'provider' ? null")
    .replace('operationInput(operation.method, request)', 'operationInput(operation.method, operation.audience, request)')
    .replace('function operationInput(method: string, request: HttpRequest): OperationInput {', 'function operationInput(method: string, audience: string, request: HttpRequest): OperationInput {')
    .replace("if (method !== 'GET' && idempotency === undefined)", "if (method !== 'GET' && audience !== 'provider' && idempotency === undefined)")
    .replace("const normalized = header?.replace(/^W\\/\"|\"$/g, '');", "const normalized = header?.replace(/^W\\//, '').replace(/^\"|\"$/g, '');")
    .replace('return { path: request.parameters, query: queryObject(request.query), body: request.body,',
      'return { path: request.parameters, query: queryObject(request.query), headers: request.headers, body: request.body, rawBody: request.rawBody, deadline: request.deadline, signal: request.signal,');
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)]));
  return value;
}

function contractIdentityOpenapi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(contractIdentityOpenapi);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      key === 'x-requirements' && Array.isArray(child)
        ? child.filter((requirement) => typeof requirement !== 'string' || !requirement.startsWith('OMS-'))
        : contractIdentityOpenapi(child),
    ]));
  }
  return value;
}

function sqlRow(values: readonly (string | number | null)[]): string {
  return `  (${values.map((value) => value === null ? 'null' : typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`).join(',')})`;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
