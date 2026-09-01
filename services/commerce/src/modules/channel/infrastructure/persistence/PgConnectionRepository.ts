import { providerLimit } from '@shop/providercore';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DisableExtensionPort, EnableExtensionPort, ExtensionRepository, InstallExtensionPort } from '../../../extension/public';
import type { ConnectionRepository } from '../../application/port/ConnectionRepository';
import { Connection, type ConnectionLimits, type ConnectionState } from '../../domain/model/Connection';
interface ConnectionRow extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly status: ConnectionState;
  readonly region: string;
  readonly connection_timeout_ms: number;
  readonly response_timeout_ms: number;
  readonly total_deadline_ms: number;
  readonly max_concurrency: number;
  readonly requests_per_second: number;
  readonly max_attempts: number;
  readonly failure_threshold: number;
  readonly recovery_ms: number;
  readonly version: number;
}
export class PgConnectionRepository implements ConnectionRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly install: InstallExtensionPort,
    private readonly enable: EnableExtensionPort,
    private readonly disable: DisableExtensionPort,
    private readonly extensions: ExtensionRepository
  ) {}
  async create(context: WriteTransactionContext, input: Parameters<ConnectionRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const id = input.id;
    const installed = await this.install.execute(context, {
      id,
      provider: input.provider,
      scope: input.scope,
      baseUrl: input.configuration.baseUrl,
      endpoints: input.configuration.endpoints,
      secretRef: input.secretRef,
      healthOperation: input.configuration.healthOperation,
      actor: input.actor,
      trace: input.trace,
    });
    const limits = connectionLimits(providerLimit(installed.manifest));
    new Connection(id, input.provider, input.scope, 'draft', input.configuration.region, limits, 0);
    const result = await database.query(
      `insert into channel.connection(id,provider,scope_id,status,contract_version,secret_ref,configuration,
      connection_timeout_ms,response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,
      failure_threshold,recovery_ms,region,version)
      values($1,$2,$3,'draft',$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,0)
      returning id,provider,scope_id,status,contract_version,region,connection_timeout_ms,response_timeout_ms,total_deadline_ms,
      max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version,created_at,updated_at,
      secret_ref is not null has_secret`,
      [
        id,
        input.provider,
        input.scope,
        installed.manifest.contractVersion,
        input.secretRef,
        JSON.stringify(input.configuration.document),
        limits.connectionTimeoutMs,
        limits.responseTimeoutMs,
        limits.totalDeadlineMs,
        limits.maxConcurrency,
        limits.requestsPerSecond,
        limits.maxAttempts,
        limits.failureThreshold,
        limits.recoveryMs,
        input.configuration.region,
      ]
    );
    return required(result.rows[0], 'CHANNEL_CONNECTION_CREATE_FAILED');
  }
  async update(context: WriteTransactionContext, input: Parameters<ConnectionRepository['update']>[1]) {
    const database = this.transactions.database(context);
    await this.install.reconfigure(context, input.id, input.scope, {
      baseUrl: input.configuration.baseUrl,
      endpoints: input.configuration.endpoints,
      secretRef: input.secretRef,
      healthOperation: input.configuration.healthOperation,
      actor: input.actor,
      trace: input.trace,
    });
    const result = await database.query(
      `update channel.connection set configuration=$3::jsonb,secret_ref=$4,region=$5,status='draft',
      version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=$2 and status in('draft','disabled')
      and ($6::bigint is null or version=$6)
      returning id,provider,scope_id,status,contract_version,region,connection_timeout_ms,response_timeout_ms,total_deadline_ms,
      max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version,created_at,updated_at,
      secret_ref is not null has_secret`,
      [input.id, input.scope, JSON.stringify(input.configuration.document), input.secretRef, input.configuration.region, input.expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
  async read(context: ReadTransactionContext, scope: string, page: Parameters<ConnectionRepository['read']>[2]) {
    const database = this.transactions.database(context);
    const result = await database.query(
      `select connection.id,connection.provider,connection.scope_id,connection.status,connection.contract_version,connection.region,
      connection.connection_timeout_ms,connection.response_timeout_ms,connection.total_deadline_ms,connection.max_concurrency,
      connection.requests_per_second,connection.max_attempts,connection.failure_threshold,connection.recovery_ms,connection.version,
      connection.created_at,connection.updated_at,connection.secret_ref is not null has_secret from channel.connection connection
      where connection.scope_id=$1 and ($2::text is null or connection.id>$2) order by connection.id limit $3`,
      [scope, page.id, page.fetch]
    );
    const summaries = new Map(
      (
        await this.extensions.summaries(
          context,
          result.rows.map((row) => String(row.id))
        )
      ).map((item) => [item.id, item])
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, ...summaries.get(String(row.id)) })));
  }
  async transition(context: WriteTransactionContext, input: Parameters<ConnectionRepository['transition']>[1]) {
    const database = this.transactions.database(context);
    const row = await this.lock(database, input.id, input.scope);
    if (input.expectedVersion !== null && row.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    connection(row).requireTransition(input.state);
    let provider = row.provider;
    if (input.state === 'testing') await this.enable.test(context, row.id, row.scope_id, input.actor, input.trace);
    if (input.state === 'enabled') {
      const displaced = await this.enable.enable(context, row.id, row.scope_id, input.actor, input.trace);
      if (displaced) await database.query(`update channel.connection set status='disabled',version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=$2 and status='enabled'`, [displaced, row.scope_id]);
    }
    if (input.state === 'disabled') provider = await this.disable.execute(context, row.id, row.scope_id, input.actor, input.trace);
    const result = await database.query<ConnectionRow>(
      `update channel.connection set status=$3,version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and version=$4 returning id,provider,scope_id,status,region,connection_timeout_ms,
      response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version`,
      [row.id, row.scope_id, input.state, row.version]
    );
    const updated = result.rows[0];
    if (!updated) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...updated, provider, ...(input.state === 'testing' ? { state: 'testing' } : {}) });
  }
  private async lock(database: ReturnType<PgTransactionAccess['database']>, id: string, scope: string): Promise<ConnectionRow> {
    const result = await database.query<ConnectionRow>(
      `select id,provider,scope_id,status,region,connection_timeout_ms,response_timeout_ms,total_deadline_ms,
      max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version
      from channel.connection where id=$1 and scope_id=$2 for update`,
      [id, scope]
    );
    if (!result.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    return result.rows[0];
  }
}
function connection(row: ConnectionRow): Connection {
  return new Connection(
    row.id,
    row.provider,
    row.scope_id,
    row.status,
    row.region,
    connectionLimits({
      connectionTimeoutMs: row.connection_timeout_ms,
      responseTimeoutMs: row.response_timeout_ms,
      totalDeadlineMs: row.total_deadline_ms,
      maxConcurrency: row.max_concurrency,
      requestsPerSecond: Number(row.requests_per_second),
      maxAttempts: row.max_attempts,
      failureThreshold: row.failure_threshold,
      recoveryMs: row.recovery_ms,
    }),
    row.version
  );
}
function connectionLimits(value: ConnectionLimits): ConnectionLimits {
  return Object.freeze({ ...value });
}
function required(row: Readonly<Record<string, unknown>> | undefined, code: string): Readonly<Record<string, unknown>> {
  if (!row) throw new Error(code);
  return Object.freeze({ ...row });
}
