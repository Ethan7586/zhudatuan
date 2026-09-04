import type { LocalProviderRuntime } from '@shop/providercore';
import type { DatabasePool } from '../foundation/persistence/Pool';

export class PgLocalProviderRuntime implements LocalProviderRuntime {
  readonly scope: string;
  private readonly provider: string;

  constructor(
    private readonly pool: DatabasePool,
    scope: string,
    provider: string
  ) {
    this.scope = required(scope, 'PROVIDER_LOCAL_SCOPE_MISSING');
    this.provider = required(provider, 'PROVIDER_LOCAL_ID_MISSING');
  }

  async invoke(operation: string, arguments_: readonly unknown[]): Promise<unknown> {
    const name = localOperation(operation, this.provider);
    if (arguments_.length > 16 || arguments_.some((value) => value === undefined)) throw new Error('PROVIDER_LOCAL_ARGUMENTS_INVALID');
    const values = [parameter(this.scope), ...arguments_.map(parameter)];
    const placeholders = values.map(({ json }, index) => `$${index + 1}${json ? '::jsonb' : ''}`);
    const parameters = values.map(({ value }) => value);
    const result = await this.pool.query<{ payload: unknown }>(`select ${name}(${placeholders.join(',')}) as payload`, parameters);
    if (result.rows.length !== 1) throw new Error('PROVIDER_LOCAL_RESULT_MISSING');
    return result.rows[0]?.payload;
  }
}

function localOperation(value: string, provider: string): string {
  const name = value.trim();
  if (!/^channel\.[a-z][a-z0-9_]{1,62}$/.test(name)) throw new Error('PROVIDER_LOCAL_OPERATION_INVALID');
  const operation = name.slice('channel.'.length);
  if (!operation.startsWith(provider + '_') && !operation.includes('_' + provider + '_') && !operation.endsWith('_' + provider)) {
    throw new Error('PROVIDER_LOCAL_OPERATION_FORBIDDEN');
  }
  return name;
}

interface LocalParameter {
  readonly value: string | number | boolean | null;
  readonly json: boolean;
}

function parameter(value: unknown): LocalParameter {
  if (value === null || typeof value === 'boolean') return { value, json: false };
  if (typeof value === 'string') {
    if (value.length > 1_048_576) throw new Error('PROVIDER_LOCAL_ARGUMENTS_TOO_LARGE');
    return { value, json: false };
  }
  if (typeof value === 'number' && Number.isFinite(value)) return { value, json: false };
  if (typeof value !== 'object') throw new Error('PROVIDER_LOCAL_ARGUMENTS_INVALID');
  const state = { nodes: 0 };
  if (!jsonValue(value, 0, state)) throw new Error('PROVIDER_LOCAL_ARGUMENTS_INVALID');
  const encoded = JSON.stringify(value);
  if (encoded.length > 1_048_576) throw new Error('PROVIDER_LOCAL_ARGUMENTS_TOO_LARGE');
  return { value: encoded, json: true };
}

function jsonValue(value: unknown, depth: number, state: { nodes: number }): boolean {
  state.nodes += 1;
  if (state.nodes > 10_000 || depth > 16) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10_000 && value.every((item) => jsonValue(item, depth + 1, state));
  if (typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return false;
  const entries = Object.entries(value);
  return entries.length <= 1_000 && entries.every(([key, item]) => key.length <= 128 && jsonValue(item, depth + 1, state));
}

function required(value: string, code: string): string {
  if (!value.trim()) throw new Error(code);
  return value.trim();
}
