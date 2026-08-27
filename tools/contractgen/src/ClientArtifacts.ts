export interface OperationDefinition {
  readonly id: string;
  readonly owner: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: `/api/v1/${string}` | `/health/${string}`;
  readonly audience: 'public' | 'member' | 'operator' | 'provider';
  readonly permission?: string;
  readonly idempotent: boolean;
  readonly schema: 'exact' | 'structural';
  readonly requirements: readonly string[];
  readonly sdk: string;
}

export interface PermissionMetadata {
  readonly risk: string;
  readonly stepup: boolean;
  readonly scopes: readonly string[];
}

export function buildOpenapi(
  operations: readonly OperationDefinition[],
  permissions: ReadonlyMap<string, PermissionMetadata>,
): unknown {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    const metadata = operation.permission === undefined ? undefined : permissions.get(operation.permission);
    const success = response('Success', 'JsonValue');
    const failure = response('Error Contract', 'Error');
    paths[operation.path] ??= {};
    paths[operation.path]![operation.method.toLowerCase()] = compact({
      operationId: operation.id,
      tags: [operation.owner],
      parameters: pathKeys(operation.path).map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string', minLength: 1 },
      })),
      requestBody: operation.method === 'GET' ? undefined : {
        required: operation.schema === 'exact',
        content: { 'application/json': { schema: reference('JsonValue') } },
      },
      'x-audience': operation.audience,
      'x-idempotency': operation.method === 'GET' || operation.audience === 'provider' ? 'none' : 'required',
      'x-idempotent': operation.idempotent,
      'x-expected-version': operation.method === 'GET' ? 'none' : 'optional',
      'x-permission': operation.permission ?? null,
      'x-requirements': operation.requirements,
      'x-risk': metadata?.risk ?? 'low',
      'x-schema-fidelity': operation.schema,
      'x-scope-kinds': metadata?.scopes ?? [],
      'x-stepup': metadata?.stepup ?? false,
      security: operation.audience === 'public' || operation.audience === 'provider' ? [] : [{ session: [] }],
      responses: {
        '200': success,
        '204': { description: 'Success without content' },
        '400': failure,
        '401': failure,
        '403': failure,
        '404': failure,
        '409': failure,
        '422': failure,
        '429': failure,
        '500': failure,
      },
    });
  }
  return stable({
    openapi: '3.1.0',
    info: { title: 'Shop Commerce API', version: '1.0.0' },
    servers: [{ url: '/' }],
    paths,
    components: {
      schemas: componentSchemas(),
      securitySchemes: { session: { type: 'http', scheme: 'bearer' } },
    },
  });
}

export function operationSource(
  values: readonly OperationDefinition[],
  permissions: ReadonlyMap<string, PermissionMetadata>,
): string {
  const rows = values.map((item) => {
    const metadata = item.permission === undefined ? undefined : permissions.get(item.permission);
    return `  ${JSON.stringify([
    item.id, item.method, item.path, item.owner, item.audience, item.permission ?? null,
    item.idempotent,
    item.method === 'GET' || item.audience === 'provider' ? 'none' : 'required',
    item.method === 'GET' ? 'none' : 'optional',
    metadata?.risk ?? 'low', metadata?.stepup ?? false, metadata?.scopes ?? [], item.schema, item.requirements,
  ])},`;
  }).join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport { operation, type HttpMethod, type OperationAudience, type OperationIdempotency, type OperationPath, type OperationRisk, type OperationSchemaFidelity, type OperationVersionPolicy } from '../Operation';\n\ntype Row = readonly [string, HttpMethod, OperationPath, string, OperationAudience, string | null, boolean, OperationIdempotency, OperationVersionPolicy, OperationRisk, boolean, readonly string[], OperationSchemaFidelity, readonly string[]];\n\nconst rows = [\n${rows}\n] as const satisfies readonly Row[];\n\nexport const COMMERCE_OPERATIONS = Object.freeze(rows.map((row) => operation({ id: row[0], method: row[1], path: row[2], module: row[3], audience: row[4], ...(row[5] === null ? {} : { permission: row[5] }), idempotent: row[6], idempotency: row[7], expectedVersion: row[8], risk: row[9], stepup: row[10], scopeKinds: row[11], schema: row[12], requirements: row[13] })));\n`;
}

export function schemaSource(values: readonly OperationDefinition[]): string {
  const rows = values.map((item) => {
    const keys = JSON.stringify(pathKeys(item.path));
    return `  ${JSON.stringify(item.id)}: Object.freeze({ input: structuralOperationInput(${keys} as const), output: structuralOperationOutput(), fidelity: ${JSON.stringify(item.schema)} }),`;
  }).join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '../OperationCatalog';\nimport { structuralOperationInput, structuralOperationOutput, type SchemaOutput } from '../schema';\n\nexport const OPERATION_SCHEMAS = Object.freeze({\n${rows}\n});\n\nexport type OperationInputFor<TKey extends OperationId> = SchemaOutput<(typeof OPERATION_SCHEMAS)[TKey]['input']>;\nexport type OperationOutputFor<TKey extends OperationId> = SchemaOutput<(typeof OPERATION_SCHEMAS)[TKey]['output']>;\n\nexport function operationSchema<TKey extends OperationId>(id: TKey): (typeof OPERATION_SCHEMAS)[TKey] {\n  return OPERATION_SCHEMAS[id];\n}\n`;
}

export function sdkSource(values: readonly OperationDefinition[]): string {
  const groups = groupOperations(values);
  const imports = [...groups].map(([domain]) => `import { create${typeName(domain)}Operations, type ${typeName(domain)}Operations } from './${domain}';`).join('\n');
  const exports = [...groups].map(([domain]) => `export type { ${typeName(domain)}Operations } from './${domain}';`).join('\n');
  const clientFields = [...groups].map(([domain]) => `  readonly ${domain}: ${typeName(domain)}Operations;`).join('\n');
  const factories = [...groups].map(([domain]) => `    ${domain}: create${typeName(domain)}Operations(client),`).join('\n');
  const ids = values.map(({ id }) => `  ${JSON.stringify(id)},`).join('\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '@shop/contract';\nimport type { OperationExecutor } from '../OperationDescriptor';\n${imports}\n\n${exports}\nexport type { OperationMethod } from '../OperationDescriptor';\n\nexport const SDK_OPERATION_IDS = /* @__PURE__ */ Object.freeze([\n${ids}\n] as const satisfies readonly OperationId[]);\n\nexport interface CommerceClient {\n${clientFields}\n}\n\nexport function createCommerceClient(client: OperationExecutor): CommerceClient {\n  return Object.freeze({\n${factories}\n  });\n}\n`;
}

export function sdkDomainSources(values: readonly OperationDefinition[]): ReadonlyMap<string, string> {
  return new Map([...groupOperations(values)].map(([domain, operations]) => [domain, sdkDomainSource(domain, operations)]));
}

function sdkDomainSource(domain: string, operations: readonly OperationDefinition[]): string {
  const name = typeName(domain);
  const ids = operations.map(({ id }) => `  ${JSON.stringify(id)},`).join('\n');
  const methods = operations.map((operation) => `  readonly ${methodName(operation.id)}: OperationMethod<${JSON.stringify(operation.id)}>;`).join('\n');
  const bindings = operations.map((operation) => `    ${methodName(operation.id)}: bind${typeName(methodName(operation.id))}(client),`).join('\n');
  const operationFactories = operations.map((operation) => {
    const method = typeName(methodName(operation.id));
    const descriptor = JSON.stringify({
      id: operation.id,
      method: operation.method,
      path: operation.path,
      audience: operation.audience,
      idempotent: operation.idempotent,
      pathKeys: pathKeys(operation.path),
    });
    return `export function createFetch${name}${method}(baseUrl: string): OperationMethod<${JSON.stringify(operation.id)}> {\n  return bind${method}(new ApiClient(baseUrl, new FetchTransport()));\n}\n\nfunction bind${method}(client: OperationExecutor): OperationMethod<${JSON.stringify(operation.id)}> {\n  return bindOperation(client, defineStructuralOperation(${descriptor}));\n}`;
  }).join('\n\n');
  return `// Generated from definitions/operations.yml. Do not edit.\nimport type { OperationId } from '@shop/contract';\nimport { ApiClient } from '../ApiClient';\nimport { FetchTransport } from '../FetchTransport';\nimport { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';\n\nexport const ${domain.toUpperCase()}_OPERATION_IDS = /* @__PURE__ */ Object.freeze([\n${ids}\n] as const satisfies readonly OperationId[]);\n\nexport interface ${name}Operations {\n${methods}\n}\n\nexport function createFetch${name}(baseUrl: string): ${name}Operations {\n  return create${name}Operations(new ApiClient(baseUrl, new FetchTransport()));\n}\n\nexport function create${name}Operations(client: OperationExecutor): ${name}Operations {\n  return Object.freeze({\n${bindings}\n  });\n}\n\n${operationFactories}\n`;
}

function componentSchemas(): Readonly<Record<string, unknown>> {
  return {
    Error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string', minLength: 1 },
        message: { type: 'string', minLength: 1 },
        requestId: { type: 'string', minLength: 1 },
        retryable: { type: 'boolean' },
        details: { type: 'object', additionalProperties: reference('JsonValue') },
      },
    },
    JsonValue: {
      oneOf: [
        { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' },
        { type: 'array', items: reference('JsonValue') },
        { type: 'object', additionalProperties: reference('JsonValue') },
      ],
    },
  };
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
    const current = result.get(domain) ?? [];
    current.push(operation);
    result.set(domain, current);
  }
  return result;
}

function methodName(id: string): string {
  const [, ...segments] = id.split('.');
  return segments.map((segment, index) => index === 0 ? segment : `${segment[0]!.toUpperCase()}${segment.slice(1)}`).join('');
}

function typeName(value: string): string {
  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function compact(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}

export function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)]));
  }
  return value;
}
