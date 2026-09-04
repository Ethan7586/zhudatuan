import { Client, type PoolClient, type QueryResultRow } from 'pg';

import {
  DEFAULT_DAYS,
  DEFAULT_ORDERS_TARGET,
  DEFAULT_SEED,
  INTERNAL_MALL_DATABASE,
  INTERNAL_MALL_DATASET,
  INTERNAL_MALL_TIMEZONE,
  type DatasetOptions,
} from './InternalMallFixtures';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function parseDatasetOptions(arguments_: readonly string[] = process.argv.slice(2)): DatasetOptions {
  return parseOptions(arguments_, true);
}

export function parseImportOptions(arguments_: readonly string[] = process.argv.slice(2)): DatasetOptions {
  return parseOptions(arguments_, false);
}

function parseOptions(arguments_: readonly string[], localOnly: boolean): DatasetOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const name = arguments_[index]!;
    if (!name.startsWith('--')) throw new Error(`INTERNAL_DATASET_ARGUMENT_INVALID:${name}`);
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`INTERNAL_DATASET_ARGUMENT_VALUE_MISSING:${name}`);
    values.set(name.slice(2), value);
    index += 1;
  }
  const dataset = values.get('dataset') ?? INTERNAL_MALL_DATASET;
  if (dataset !== INTERNAL_MALL_DATASET) throw new Error('INTERNAL_DATASET_ID_INVALID');
  const databaseArgument = values.get('database');
  if (!localOnly && !databaseArgument) throw new Error('INTERNAL_DATASET_IMPORT_DATABASE_REQUIRED');
  const database = databaseArgument ?? INTERNAL_MALL_DATABASE;
  const host = values.get('host') ?? (localOnly ? '127.0.0.1' : process.env.PGHOST ?? '127.0.0.1');
  const port = integer(values.get('port') ?? (localOnly ? process.env.INTERNAL_DATASET_DB_PORT ?? '55432' : process.env.PGPORT ?? '5432'),
    1, 65_535, 'INTERNAL_DATASET_PORT_INVALID');
  const days = integer(values.get('days') ?? String(DEFAULT_DAYS), 1, 366, 'INTERNAL_DATASET_DAYS_INVALID');
  const ordersTarget = integer(values.get('orders-target') ?? String(DEFAULT_ORDERS_TARGET), 1, 1_000_000, 'INTERNAL_DATASET_ORDER_TARGET_INVALID');
  const seed = integer(values.get('seed') ?? String(DEFAULT_SEED), 1, 0xffff_ffff, 'INTERNAL_DATASET_SEED_INVALID');
  if (localOnly && !database.startsWith('zhudatuan_internal_')) throw new Error('INTERNAL_DATASET_DATABASE_PREFIX_INVALID');
  if (localOnly && !LOCAL_HOSTS.has(host)) throw new Error('INTERNAL_DATASET_DATABASE_HOST_NOT_LOCAL');
  if (ordersTarget < days) throw new Error('INTERNAL_DATASET_ORDERS_MUST_COVER_EVERY_DAY');
  return Object.freeze({ database, days, host, ordersTarget, port, seed });
}

export async function connectInternalDatabase(options: DatasetOptions): Promise<Client> {
  const user = required(process.env.POSTGRES_USER, 'INTERNAL_DATASET_POSTGRES_USER_MISSING');
  const password = required(process.env.POSTGRES_PASSWORD, 'INTERNAL_DATASET_POSTGRES_PASSWORD_MISSING');
  const client = new Client({
    application_name: 'internal_hongtai_dataset',
    database: options.database,
    host: options.host,
    password,
    port: options.port,
    statement_timeout: 120_000,
    user,
  });
  await client.connect();
  await client.query(`set timezone to '${INTERNAL_MALL_TIMEZONE}'`);
  return client;
}

export async function assertInternalDatabase(client: Client | PoolClient, options: DatasetOptions, allowDatasetRows: boolean): Promise<void> {
  const result = await client.query<{
    readonly address: string | null;
    readonly database: string;
    readonly migrations: string;
    readonly port: number;
    readonly schema_ready: boolean;
    readonly user: string;
  }>(`select current_database() database,current_user "user",host(inet_server_addr()) address,inet_server_port() port,
      to_regclass('runtime.schemaversion') is not null schema_ready,
      (select count(*)::text from supabase_migrations.schema_migrations) migrations`);
  const row = result.rows[0];
  process.stdout.write(`DATABASE_IDENTITY database=${row?.database ?? 'unknown'} user=${row?.user ?? 'unknown'} address=${row?.address ?? 'local-socket'} port=${row?.port ?? 0}\n`);
  if (!row || row.database !== options.database || !row.database.startsWith('zhudatuan_internal_')) throw new Error('INTERNAL_DATASET_DATABASE_IDENTITY_INVALID');
  if (!isLocalDatabaseAddress(row.address)) throw new Error('INTERNAL_DATASET_SERVER_ADDRESS_INVALID');
  if (row.port !== 5432 || !row.schema_ready || Number(row.migrations) <= 0) throw new Error('INTERNAL_DATASET_SCHEMA_NOT_READY');
  const foreign = await client.query<{ readonly count: string }>(`select count(*)::text count from ordering.orderrecord
    where order_number not like 'ITHT-%'`);
  if (Number(foreign.rows[0]?.count ?? -1) !== 0) throw new Error('INTERNAL_DATASET_FOREIGN_ORDER_DATA_PRESENT');
  if (!allowDatasetRows) {
    const existing = await client.query<{ readonly count: string }>("select count(*)::text count from ordering.orderrecord where order_number like 'ITHT-%'");
    if (Number(existing.rows[0]?.count ?? -1) !== 0) throw new Error('INTERNAL_DATASET_ALREADY_PRESENT');
  }
}

export async function assertImportDatabase(client: Client | PoolClient, options: DatasetOptions): Promise<void> {
  const result = await client.query<{
    readonly address: string | null;
    readonly database: string;
    readonly migrations: string;
    readonly port: number;
    readonly schema_ready: boolean;
    readonly user: string;
  }>(`select current_database() database,current_user "user",host(inet_server_addr()) address,inet_server_port() port,
      to_regclass('runtime.schemaversion') is not null schema_ready,
      (select count(*)::text from supabase_migrations.schema_migrations) migrations`);
  const row = result.rows[0];
  process.stdout.write(`IMPORT_DATABASE_IDENTITY database=${row?.database ?? 'unknown'} user=${row?.user ?? 'unknown'} address=${row?.address ?? 'local-socket'} port=${row?.port ?? 0}\n`);
  if (!row || row.database !== options.database) throw new Error('INTERNAL_DATASET_IMPORT_DATABASE_IDENTITY_INVALID');
  if (!row.schema_ready || Number(row.migrations) <= 0) throw new Error('INTERNAL_DATASET_IMPORT_SCHEMA_NOT_READY');
}

export async function insertRows(
  client: Client | PoolClient,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
  conflict = '',
  batchSize = 200,
): Promise<number> {
  if (!/^[_a-z][_a-z0-9]*\.[_a-z][_a-z0-9]*$/.test(table) || columns.some((column) => !/^[_a-z][_a-z0-9]*$/.test(column))) {
    throw new Error('INTERNAL_DATASET_INSERT_IDENTIFIER_INVALID');
  }
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    if (batch.some((row) => row.length !== columns.length)) throw new Error(`INTERNAL_DATASET_INSERT_SHAPE_INVALID:${table}`);
    const parameters: unknown[] = [];
    const values = batch.map((row) => {
      const placeholders = row.map((value) => {
        parameters.push(value);
        return `$${parameters.length}`;
      });
      return `(${placeholders.join(',')})`;
    });
    let result;
    try {
      result = await client.query(`insert into ${table}(${columns.join(',')}) values ${values.join(',')} ${conflict}`, parameters);
    } catch (cause) {
      const error = cause as Error & { readonly code?: string };
      throw Object.assign(new Error(`INTERNAL_DATASET_INSERT_FAILED:${table}:${error.message}`, { cause }), { code: error.code });
    }
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

export async function scalarNumber(client: Client | PoolClient, sql: string, parameters: readonly unknown[] = []): Promise<number> {
  const result = await client.query<{ readonly value: string | number }>(sql, [...parameters]);
  return Number(result.rows[0]?.value ?? 0);
}

export async function queryRows<T extends QueryResultRow>(client: Client | PoolClient, sql: string, parameters: readonly unknown[] = []): Promise<readonly T[]> {
  return (await client.query<T>(sql, [...parameters])).rows;
}

export async function postFinance(client: Client | PoolClient, input: Readonly<{
  amountMinor: number;
  creditCode: string;
  creditKind: 'asset' | 'liability' | 'income' | 'expense';
  debitCode: string;
  debitKind: 'asset' | 'liability' | 'income' | 'expense';
  description: string;
  occurredAt: string;
  referenceId: string;
  referenceType: string;
  scope: string;
}>): Promise<string> {
  let result;
  try {
    result = await client.query<{ readonly journal: string }>('select finance.post($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz) journal', [
      input.scope,
      input.referenceType,
      input.referenceId,
      'CNY',
      input.description,
      input.debitCode,
      input.debitKind,
      input.creditCode,
      input.creditKind,
      input.amountMinor,
      input.occurredAt,
    ]);
  } catch (cause) {
    const error = cause as Error & { readonly code?: string };
    throw Object.assign(new Error(`INTERNAL_DATASET_FINANCE_POST_FAILED:${input.referenceType}:${error.message}`, { cause }), { code: error.code });
  }
  const journal = result.rows[0]?.journal;
  if (!journal) throw new Error('INTERNAL_DATASET_FINANCE_POST_FAILED');
  return journal;
}

export function stage(name: string, counts: Readonly<Record<string, number>>): void {
  process.stdout.write(`DATASET_STAGE ${name} ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(' ')}\n`);
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}

function isLocalDatabaseAddress(address: string | null): boolean {
  if (address === null || address === '127.0.0.1' || address === '::1') return true;
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function integer(value: string, minimum: number, maximum: number, code: string): number {
  const selected = Number(value);
  if (!Number.isSafeInteger(selected) || selected < minimum || selected > maximum) throw new Error(code);
  return selected;
}
