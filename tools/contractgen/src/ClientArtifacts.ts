import { toJSONSchema, type ZodMiniType } from 'zod/mini';
import { definedOperationBodySchema, definedOperationOutputSchema, definedOperationQuerySchema } from '../../../packages/contract/src/schema/index';

export interface OperationDefinition {
  readonly id: string;
  readonly owner: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: `/api/v1/${string}` | `/health/${string}`;
  readonly audience: 'public' | 'console' | 'storefront' | 'system' | 'webhook';
  readonly targets: readonly ('console' | 'storefront')[];
  readonly permission: string | null;
  readonly capability: string;
  readonly scopeKinds: readonly string[];
  readonly assuranceLevel: 'anonymous' | 'optional' | 'preauth' | 'session' | 'mfa' | 'stepup' | 'service' | 'signed';
  readonly makerChecker: boolean;
  readonly originPolicy: 'none' | 'sameorigin' | 'service' | 'signed';
  readonly csrfPolicy: 'none' | 'required';
  readonly responseMode: 'json' | 'redirect' | 'empty' | 'stream';
  readonly cachePolicy: 'none' | 'private' | 'etag';
  readonly targetPolicy: 'public' | 'exact' | 'service' | 'webhook';
  readonly idempotencyPolicy: 'none' | 'required' | 'provider';
  readonly requestSchema: string;
  readonly responseSchema: string;
  readonly errorUnion: readonly string[];
  readonly idempotencyScope: 'none' | 'actor-operation-scope' | 'provider-operation';
  readonly expectedVersion: 'none' | 'required';
  readonly timeout: number;
  readonly rateClass: 'health' | 'identity' | 'read' | 'write' | 'critical' | 'webhook';
  readonly risk: 'low' | 'elevated' | 'high' | 'critical';
  readonly resourceResolver: string;
  readonly resourceParameter: string | null;
  readonly idempotent: boolean;
  readonly requirements: readonly string[];
  readonly controller: string;
  readonly handler: string;
  readonly sdk: string;
}

export function buildOpenapi(operations: readonly OperationDefinition[], errorCatalog: ReadonlyMap<string, number>, version: string): unknown {
  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: Record<string, unknown> = { Error: errorSchema() };
  for (const operation of operations) {
    schemas[operation.requestSchema] = requestSchema(operation);
    schemas[operation.responseSchema] = responseSchema(operation);
    const responses: Record<string, unknown> =
      operation.responseMode === 'redirect'
        ? { '303': { description: 'Validated same-site redirect', headers: { Location: { required: true, schema: { type: 'string', format: 'uri' } } } } }
        : operation.responseMode === 'empty'
          ? { '204': { description: 'Success without a response body' } }
          : operation.responseMode === 'stream'
            ? { '200': { description: 'Server-sent event stream', content: { 'text/event-stream': { schema: { type: 'string' } } } } }
            : { '200': response('Success', operation.responseSchema) };
    if (operation.cachePolicy === 'etag') responses['304'] = { description: 'Not modified', headers: { ETag: { required: true, schema: { type: 'string' } } } };
    for (const status of errorStatuses(operation.errorUnion, errorCatalog)) responses[String(status)] = response('Typed operation error', 'Error');
    paths[operation.path] ??= {};
    paths[operation.path]![operation.method.toLowerCase()] = compact({
      operationId: operation.id,
      tags: [operation.owner],
      parameters: [...pathKeys(operation.path).map((name) => ({ name, in: 'path', required: true, schema: { type: 'string', minLength: 1 } })), ...(operation.method === 'GET' ? queryParameters(operation.requestSchema) : [])],
      requestBody:
        operation.method === 'GET'
          ? undefined
          : {
              required: true,
              content: { 'application/json': { schema: bodySchema(operation.requestSchema) } },
            },
      'x-audience': operation.audience,
      'x-targets': operation.targets,
      'x-assurance-level': operation.assuranceLevel,
      'x-capability': operation.capability,
      'x-error-union': operation.errorUnion,
      'x-expected-version': operation.expectedVersion,
      'x-idempotency-scope': operation.idempotencyScope,
      'x-maker-checker': operation.makerChecker,
      'x-origin-policy': operation.originPolicy,
      'x-csrf-policy': operation.csrfPolicy,
      'x-response-mode': operation.responseMode,
      'x-cache-policy': operation.cachePolicy,
      'x-target-policy': operation.targetPolicy,
      'x-idempotency-policy': operation.idempotencyPolicy,
      'x-permission': operation.permission,
      'x-rate-class': operation.rateClass,
      'x-requirements': operation.requirements,
      'x-resource-resolver': operation.resourceResolver,
      'x-resource-parameter': operation.resourceParameter,
      'x-risk': operation.risk,
      'x-scope-kinds': operation.scopeKinds,
      'x-timeout-ms': operation.timeout,
      security: operation.assuranceLevel === 'anonymous' || operation.audience === 'webhook' ? [] : operation.assuranceLevel === 'optional' ? [{}, { session: [] }] : [{ session: [] }],
      responses,
    });
  }
  return stable({
    openapi: '3.1.0',
    info: { title: 'Shop Commerce API', version },
    servers: [{ url: '/' }],
    paths,
    components: { schemas, securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: '__Host-console-session' } } },
  });
}

export function operationSource(values: readonly OperationDefinition[]): string {
  const definitions = values.map((item) => ({
    id: item.id,
    method: item.method,
    path: item.path,
    module: item.owner,
    audience: item.audience,
    targets: item.targets,
    permission: item.permission,
    capability: item.capability,
    scopeKinds: item.scopeKinds,
    assuranceLevel: item.assuranceLevel,
    makerChecker: item.makerChecker,
    originPolicy: item.originPolicy,
    csrfPolicy: item.csrfPolicy,
    responseMode: item.responseMode,
    cachePolicy: item.cachePolicy,
    targetPolicy: item.targetPolicy,
    idempotencyPolicy: item.idempotencyPolicy,
    requestSchema: item.requestSchema,
    responseSchema: item.responseSchema,
    errorUnion: item.errorUnion,
    idempotencyScope: item.idempotencyScope,
    expectedVersion: item.expectedVersion,
    timeout: item.timeout,
    rateClass: item.rateClass,
    risk: item.risk,
    resourceResolver: item.resourceResolver,
    resourceParameter: item.resourceParameter,
    idempotent: item.idempotent,
    requirements: item.requirements,
  }));
  return `// Generated from definitions/operations.yml. Do not edit.\nimport { operation, type Operation } from '../Operation';\n\nconst definitions = ${JSON.stringify(definitions, null, 2)} as const satisfies readonly Operation[];\n\nexport const COMMERCE_OPERATIONS = Object.freeze(definitions.map(operation));\n`;
}

export function schemaSource(values: readonly OperationDefinition[]): string {
  const rows = values
    .map((item) => {
      const keys = JSON.stringify(pathKeys(item.path));
      return `  ${JSON.stringify(item.id)}: Object.freeze({ input: exactOperationInput(${JSON.stringify(item.requestSchema)}, ${keys} as const, ${item.method !== 'GET'}), output: exactOperationOutput(${JSON.stringify(item.responseSchema)}) }),`;
    })
    .join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '../OperationCatalog';\nimport type { IdentityOperationInputs } from '../IdentityInput';\nimport { exactOperationInput, exactOperationOutput, type SchemaOutput } from '../schema';\n\nexport const OPERATION_SCHEMAS = Object.freeze({\n${rows}\n});\n\ntype StrictOperationInput<TKey extends OperationId> = TKey extends keyof IdentityOperationInputs\n  ? IdentityOperationInputs[TKey]\n  : SchemaOutput<(typeof OPERATION_SCHEMAS)[TKey]['input']>;\nexport type OperationInputFor<TKey extends OperationId> = StrictOperationInput<TKey>;\nexport type OperationOutputFor<TKey extends OperationId> = SchemaOutput<(typeof OPERATION_SCHEMAS)[TKey]['output']>;\n\nexport function operationSchema<TKey extends OperationId>(id: TKey): (typeof OPERATION_SCHEMAS)[TKey] { return OPERATION_SCHEMAS[id]; }\n`;
}

export function sdkSource(values: readonly OperationDefinition[]): string {
  const groups = groupOperations(values);
  const imports = [...groups].map(([domain]) => `import { create${typeName(domain)}Operations, type ${typeName(domain)}Operations } from './${domain}';`).join('\n');
  const exports = [...groups].map(([domain]) => `export type { ${typeName(domain)}Operations } from './${domain}';`).join('\n');
  const clientFields = [...groups].map(([domain]) => `  readonly ${domain}: ${typeName(domain)}Operations;`).join('\n');
  const factories = [...groups].map(([domain]) => `    ${domain}: create${typeName(domain)}Operations(client),`).join('\n');
  const ids = values.map(({ id }) => `  ${JSON.stringify(id)},`).join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '@shop/contract';\nimport type { OperationExecutor } from '../OperationDescriptor';\n${imports}\n\n${exports}\nexport type { EventOperationMethod, OperationMethod } from '../OperationDescriptor';\n\nexport const SDK_OPERATION_IDS = Object.freeze([\n${ids}\n] as const satisfies readonly OperationId[]);\n\nexport interface CommerceClient {\n${clientFields}\n}\n\nexport function createCommerceClient(client: OperationExecutor): CommerceClient { return Object.freeze({\n${factories}\n  }); }\n`;
}

export function sdkDomainSources(values: readonly OperationDefinition[]): ReadonlyMap<string, string> {
  return new Map([...groupOperations(values)].map(([domain, operations]) => [domain, sdkDomainSource(domain, operations)]));
}

export function identityClientSchemaSource(values: readonly OperationDefinition[]): string {
  const rows = values
    .filter(({ id }) => id.startsWith('identity.'))
    .map((operation) => `  ${JSON.stringify(operation.id)}: Object.freeze({ input: identityInputSchema(${JSON.stringify(operation.requestSchema)}, ${JSON.stringify(pathKeys(operation.path))}, ${operation.method !== 'GET'}), output: identityOutputSchema(${JSON.stringify(operation.responseSchema)}) }),`)
    .join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId, OperationInputFor, OperationOutputFor, Schema } from '..';\nimport { identityInputSchema } from '../schema/IdentityInputSchema';\nimport { SECURITY_OUTPUT_SCHEMAS } from '../schema/AccessSchema';\nimport { IDENTITY_OUTPUT_SCHEMAS } from '../schema/IdentitySchema';\n\nconst outputs = Object.freeze({ ...SECURITY_OUTPUT_SCHEMAS, ...IDENTITY_OUTPUT_SCHEMAS });\nconst schemas = Object.freeze({\n${rows}\n});\nexport type IdentityOperationId = Extract<OperationId, \`identity.\${string}\`>;\nexport function identityClientSchema<TKey extends IdentityOperationId>(id: TKey): Readonly<{ input: Schema<OperationInputFor<TKey>>; output: Schema<OperationOutputFor<TKey>> }> {\n  const pair = schemas[id];\n  if (pair === undefined) throw new Error('IDENTITY_OPERATION_SCHEMA_MISSING');\n  return pair as unknown as Readonly<{ input: Schema<OperationInputFor<TKey>>; output: Schema<OperationOutputFor<TKey>> }>;\n}\nfunction identityOutputSchema(name: string): Schema<unknown> {\n  const schema = Reflect.get(outputs, name) as Schema<unknown> | undefined;\n  if (schema === undefined) throw new Error(\`IDENTITY_OUTPUT_SCHEMA_MISSING:\${name}\`);\n  return schema;\n}\n`;
}

function sdkDomainSource(domain: string, operations: readonly OperationDefinition[]): string {
  const name = typeName(domain);
  const ids = operations.map(({ id }) => `  ${JSON.stringify(id)},`).join('\n');
  const methods = operations
    .map((operation) => `  readonly ${methodName(operation.id)}: ${operation.responseMode === 'stream' ? 'EventOperationMethod' : 'OperationMethod'}<${JSON.stringify(operation.id)}>;`)
    .join('\n');
  const bindings = operations.map((operation) => `    ${methodName(operation.id)}: bind${typeName(methodName(operation.id))}(client),`).join('\n');
  const factories = operations
    .map((operation) => {
      const method = typeName(methodName(operation.id));
      const descriptor = JSON.stringify({
        id: operation.id,
        method: operation.method,
        path: operation.path,
        audience: operation.audience,
        targets: operation.targets,
        responseMode: operation.responseMode,
        idempotent: operation.idempotent,
        timeout: operation.timeout,
        errorUnion: operation.errorUnion,
      });
      const operationMethod = operation.responseMode === 'stream' ? 'EventOperationMethod' : 'OperationMethod';
      const binder = operation.responseMode === 'stream' ? 'bindEventOperation' : 'bindOperation';
      const schema =
        domain === 'identity'
          ? `, ...identityClientSchema(${JSON.stringify(operation.id)})`
          : `, input: exactOperationInput(${JSON.stringify(operation.requestSchema)}, ${JSON.stringify(pathKeys(operation.path))} as const, ${operation.method !== 'GET'}), output: exactOperationOutput(${JSON.stringify(operation.responseSchema)})`;
      return `export function createFetch${name}${method}(baseUrl: string): ${operationMethod}<${JSON.stringify(operation.id)}> { return bind${method}(new ApiClient(baseUrl, new FetchTransport())); }\n\nfunction bind${method}(client: OperationExecutor): ${operationMethod}<${JSON.stringify(operation.id)}> { return ${binder}(client, ${domain === 'identity' ? 'defineScopedOperation' : 'defineOperation'}({ ...${descriptor}${schema} })); }`;
    })
    .join('\n\n');
  const schemaImport =
    domain === 'identity'
      ? `import { identityClientSchema } from '@shop/contract/identityschema';\nimport { defineScopedOperation } from '../ScopedOperationDescriptor';`
      : `import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';\nimport { defineOperation } from '../CatalogOperationDescriptor';`;
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '@shop/contract';\nimport { ApiClient } from '../ApiClient';\nimport { FetchTransport } from '../FetchTransport';\nimport { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';\n${schemaImport}\n\nexport const ${domain.toUpperCase()}_OPERATION_IDS = Object.freeze([\n${ids}\n] as const satisfies readonly OperationId[]);\n\nexport interface ${name}Operations {\n${methods}\n}\n\nexport function createFetch${name}(baseUrl: string): ${name}Operations { return create${name}Operations(new ApiClient(baseUrl, new FetchTransport())); }\n\nexport function create${name}Operations(client: OperationExecutor): ${name}Operations { return Object.freeze({\n${bindings}\n  }); }\n\n${factories}\n`;
}

function requestSchema(operation: OperationDefinition): unknown {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const keys = pathKeys(operation.path);
  if (keys.length) {
    properties.path = { type: 'object', additionalProperties: false, required: keys, properties: Object.fromEntries(keys.map((key) => [key, { type: 'string', minLength: 1 }])) };
    required.push('path');
  }
  if (operation.method === 'GET') properties.query = querySchema(operation.requestSchema);
  else {
    properties.body = bodySchema(operation.requestSchema);
    required.push('body');
  }
  return { type: 'object', additionalProperties: false, required, properties };
}

function bodySchema(name: string): unknown {
  const schema = jsonSchema(definedOperationBodySchema(name));
  if (schema === undefined) throw new Error(`OPENAPI_BODY_SCHEMA_MISSING:${name}`);
  return schema;
}

function querySchema(name: string): unknown {
  const schema = jsonSchema(definedOperationQuerySchema(name));
  if (schema === undefined) throw new Error(`OPENAPI_QUERY_SCHEMA_MISSING:${name}`);
  return schema;
}

function queryParameters(name: string): readonly unknown[] {
  const schema = querySchema(name) as Readonly<{ properties?: Readonly<Record<string, unknown>>; required?: readonly string[] }>;
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([parameter, value]) => ({
    name: parameter,
    in: 'query',
    required: required.has(parameter),
    schema: value,
  }));
}

function responseSchema(operation: OperationDefinition): unknown {
  if (operation.responseMode === 'empty') return { type: 'null' };
  const schema = jsonSchema(definedOperationOutputSchema(operation.responseSchema));
  if (schema === undefined) throw new Error(`OPENAPI_OUTPUT_SCHEMA_MISSING:${operation.id}:${operation.responseSchema}`);
  return schema;
}

function jsonSchema(schema: ZodMiniType | undefined): unknown | undefined {
  if (schema === undefined) return undefined;
  const { $schema: _ignored, ...value } = toJSONSchema(schema, { target: 'draft-2020-12' });
  return value;
}

function errorSchema(): unknown {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'message', 'requestId', 'retryable'],
    properties: {
      code: { type: 'string', minLength: 1 },
      message: { type: 'string', minLength: 1 },
      requestId: { type: 'string', minLength: 1 },
      retryable: { type: 'boolean' },
      details: { type: 'object', additionalProperties: false, required: ['field'], properties: { field: { type: 'string', minLength: 1 } } },
    },
  };
}

function errorStatuses(codes: readonly string[], catalog: ReadonlyMap<string, number>): readonly number[] {
  const statuses = new Set(
    codes.map((code) => {
      const status = catalog.get(code);
      if (status === undefined) throw new Error(`OPENAPI_ERROR_UNKNOWN:${code}`);
      return status;
    })
  );
  return [...statuses].sort();
}

function response(description: string, schema: string): unknown {
  return { description, content: { 'application/json': { schema: reference(schema) } } };
}
function reference(name: string): Readonly<{ $ref: string }> {
  return { $ref: `#/components/schemas/${name}` };
}
function pathKeys(path: string): readonly string[] {
  return [...path.matchAll(/\{([a-z][a-z0-9]*)\}/g)].map((match) => match[1]!);
}
function groupOperations(values: readonly OperationDefinition[]): ReadonlyMap<string, readonly OperationDefinition[]> {
  const result = new Map<string, OperationDefinition[]>();
  for (const operation of values) {
    const domain = operation.id.split('.')[0]!;
    result.set(domain, [...(result.get(domain) ?? []), operation]);
  }
  return result;
}
function methodName(id: string): string {
  const [, ...segments] = id.split('.');
  return segments.map((segment, index) => (index === 0 ? segment : `${segment[0]!.toUpperCase()}${segment.slice(1)}`)).join('');
}
function typeName(value: string): string {
  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}
function compact(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}
export function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)])
    );
  return value;
}
