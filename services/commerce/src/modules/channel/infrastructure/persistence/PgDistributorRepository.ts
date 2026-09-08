import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ChannelCapabilityPort } from '../../../capability/public';
import type { ChannelOrganizationPort, OrganizationReadPort } from '../../../organization/public';
import type { DistributorRepository } from '../../application/port/DistributorRepository';
import { Binding, Distributor, type DistributorState } from '../../domain/model/Distributor';
import { Quota } from '../../domain/model/Quota';
import { ChannelPolicy } from '../../domain/policy/ChannelPolicy';

interface DistributorRow extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly organization_id: string;
  readonly code: string;
  readonly name: string;
  readonly settlement_mode: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly status: DistributorState;
  readonly has_contact: boolean;
  readonly active_bindings: number;
  readonly version: number;
}

export class PgDistributorRepository implements DistributorRepository {
  private readonly policy = new ChannelPolicy();
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organization: ChannelOrganizationPort,
    private readonly organizations: OrganizationReadPort,
    private readonly capability: ChannelCapabilityPort
  ) {}
  async create(context: WriteTransactionContext, input: Parameters<DistributorRepository['create']>[1]) {
    const database = this.transactions.database(context);
    new Distributor({
      id: input.id,
      organization: input.id,
      code: input.code,
      name: input.name,
      settlementMode: input.settlementMode,
      metadata: input.metadata,
      state: 'active',
      activeBindings: 0,
      hasContact: input.contact !== null,
      version: 0,
    });
    await this.organization.createDistributor(context, { id: input.id, parent: input.scope, name: input.name, timezone: input.timezone });
    const result = await database.query(
      `insert into channel.distributor(id,organization_id,code,name,contact_ciphertext,contact_token,contact_key_version,
      settlement_mode,metadata,status,created_at,updated_at,version) values($1,$1,$2,$3,$4,$5,$6,$7,$8::jsonb,'active',clock_timestamp(),clock_timestamp(),0)
      returning id,organization_id,code,name,settlement_mode,metadata,status,created_at,updated_at,version`,
      [input.id, input.code, input.name, input.contact?.ciphertext ?? null, input.contact?.fingerprint ?? null, input.contact?.keyVersion ?? null, input.settlementMode, JSON.stringify(input.metadata)]
    );
    return required(result.rows[0], 'CHANNEL_DISTRIBUTOR_CREATE_FAILED');
  }
  async read(context: ReadTransactionContext, scope: string, page: Parameters<DistributorRepository['read']>[2]) {
    const database = this.transactions.database(context);
    const scopes = await this.organizations.descendants(context, scope);
    const result = await database.query(
      `select distributor.id,distributor.organization_id,distributor.code,distributor.name,
      distributor.settlement_mode,distributor.metadata,distributor.status,distributor.created_at,distributor.updated_at,
      distributor.version,count(binding.id)::integer tenant_count from channel.distributor distributor
      left join channel.tenantbinding binding on binding.distributor_id=distributor.id and binding.state='active'
      where distributor.organization_id=any($1::text[])
      and ($2::timestamptz is null or (distributor.updated_at,distributor.id)<($2::timestamptz,$3))
      group by distributor.id order by distributor.updated_at desc,distributor.id desc limit $4`,
      [scopes, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async update(context: WriteTransactionContext, input: Parameters<DistributorRepository['update']>[1]) {
    const database = this.transactions.database(context);
    if (!(await this.organization.visible(context, input.scope, input.id))) throw new DomainError('RESOURCE_NOT_FOUND');
    const current = await this.lock(database, input.id);
    if (input.expectedVersion !== null && input.expectedVersion !== current.value.version) throw new DomainError('VERSION_CONFLICT');
    current.requireMutable();
    new Distributor({
      ...current.value,
      name: input.name ?? current.value.name,
      settlementMode: input.settlementMode ?? current.value.settlementMode,
      metadata: input.metadata ?? current.value.metadata,
      hasContact: input.contactChanged ? input.contact !== null : current.value.hasContact,
      version: current.value.version + 1,
    });
    const result = await database.query(
      `update channel.distributor set name=coalesce($2,name),settlement_mode=coalesce($3,settlement_mode),
      metadata=coalesce($4::jsonb,metadata),contact_ciphertext=case when $5::boolean then $6 else contact_ciphertext end,
      contact_token=case when $5::boolean then $7 else contact_token end,contact_key_version=case when $5::boolean then $8 else contact_key_version end,
      updated_at=clock_timestamp(),version=version+1 where id=$1 and version=$9
      returning id,organization_id,code,name,settlement_mode,metadata,status,created_at,updated_at,version`,
      [
        input.id,
        input.name,
        input.settlementMode,
        input.metadata === null ? null : JSON.stringify(input.metadata),
        input.contactChanged,
        input.contact?.ciphertext ?? null,
        input.contact?.fingerprint ?? null,
        input.contact?.keyVersion ?? null,
        current.value.version,
      ]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    if (input.name !== null) await this.organization.rename(context, input.id, input.name);
    return Object.freeze({ ...result.rows[0] });
  }
  async disable(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number | null) {
    const database = this.transactions.database(context);
    if (!(await this.organization.visible(context, scope, id))) throw new DomainError('RESOURCE_NOT_FOUND');
    const current = await this.lock(database, id);
    if (expectedVersion !== null && expectedVersion !== current.value.version) throw new DomainError('VERSION_CONFLICT');
    current.requireTermination();
    const result = await database.query(
      `update channel.distributor distributor set status='terminated',updated_at=clock_timestamp(),version=version+1
      where distributor.id=$1 and distributor.organization_id=$1 and distributor.version=$2
      and not exists(select 1 from channel.tenantbinding where distributor_id=distributor.id and state='active')
      returning distributor.id,distributor.organization_id,distributor.code,distributor.name,distributor.settlement_mode,
      distributor.metadata,distributor.status,distributor.created_at,distributor.updated_at,distributor.version`,
      [id, current.value.version]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    await this.organization.disable(context, id);
    return Object.freeze({ ...result.rows[0] });
  }
  async manageBinding(context: WriteTransactionContext, input: Parameters<DistributorRepository['manageBinding']>[1]) {
    const database = this.transactions.database(context);
    if (!(await this.organization.bindingAllowed(context, input.root, input.distributor, input.tenant))) throw new Error('BINDING_SCOPE_INVALID');
    const effectiveAt = instant(input.effectiveAt) ?? new Date().toISOString();
    const expiresAt = instant(input.expiresAt);
    new Binding({ id: input.id, distributor: input.distributor, tenant: input.tenant, state: input.state, effectiveAt, expiresAt, version: input.expectedVersion ?? 0 });
    const result = await database.query(
      `insert into channel.tenantbinding(id,distributor_id,tenant_id,state,evidence,effective_at,expires_at,created_at,updated_at,version)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,clock_timestamp(),clock_timestamp(),0) on conflict(id) do update
      set state=excluded.state,evidence=excluded.evidence,expires_at=excluded.expires_at,updated_at=clock_timestamp(),version=channel.tenantbinding.version+1
      where channel.tenantbinding.distributor_id=$2 and channel.tenantbinding.tenant_id=$3
      and ($8::bigint is null or channel.tenantbinding.version=$8)
      returning *`,
      [input.id, input.distributor, input.tenant, input.state, JSON.stringify(input.evidence), effectiveAt, expiresAt, input.expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
  async manageQuota(context: WriteTransactionContext, input: Parameters<DistributorRepository['manageQuota']>[1]) {
    const effectiveAt = new Date().toISOString();
    const expiresAt = instant(input.expiresAt);
    const quota = new Quota({ id: input.id, scope: input.scope, capability: input.capability, state: input.state, limit: input.quota, effectiveAt, expiresAt, version: input.expectedVersion ?? 0 });
    this.policy.requireQuotaConfiguration(quota);
    const result = await this.capability.save(requireWriteTransaction(this.transactions.database(context).transaction), input);
    if (!result) throw new DomainError('VERSION_CONFLICT');
    return result;
  }

  private async lock(database: ReturnType<PgTransactionAccess['database']>, id: string): Promise<Distributor> {
    const result = await database.query<DistributorRow>(
      `select distributor.id,distributor.organization_id,distributor.code,distributor.name,distributor.settlement_mode,
      distributor.metadata,distributor.status,distributor.contact_ciphertext is not null has_contact,
      (select count(*)::integer from channel.tenantbinding binding where binding.distributor_id=distributor.id and binding.state='active') active_bindings,
      distributor.version from channel.distributor distributor where distributor.id=$1 for update`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return new Distributor({
      id: row.id,
      organization: row.organization_id,
      code: row.code,
      name: row.name,
      settlementMode: row.settlement_mode,
      metadata: row.metadata,
      state: row.status,
      activeBindings: Number(row.active_bindings),
      hasContact: row.has_contact,
      version: Number(row.version),
    });
  }
}
function required(row: Readonly<Record<string, unknown>> | undefined, code: string): Readonly<Record<string, unknown>> {
  if (!row) throw new Error(code);
  return Object.freeze({ ...row });
}

function instant(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('CHANNEL_INSTANT_INVALID');
  return new Date(value).toISOString();
}
