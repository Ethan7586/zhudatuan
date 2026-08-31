import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { FinanceRepository } from '../../application/port/FinanceRepository';

/** Finance-owned persistence primitives shared by commands; callers retain the surrounding unit of work. */
export class PgFinanceRepository implements FinanceRepository {
  constructor(private readonly database: OperationDatabase) {}

  async enqueue(kind: 'reconciliation' | 'settlement' | 'invoice', scope: string, payload: unknown, id: string, replay = false, priority = 20): Promise<void> {
    await this.database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,'finance',$3,$4::jsonb,'queued',$5,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do update
      set state='queued',attempts=0,last_error=null,available_at=clock_timestamp(),updated_at=clock_timestamp()
      where $6::boolean and runtime.job.state='failed'`,
      [id, kind, scope, JSON.stringify(payload), priority, replay]
    );
  }

  async event(type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown, stableId?: string): Promise<void> {
    const id = stableId ?? `event:${randomUUID()}`;
    await this.database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,$2,1,$3,$4,$5,$6::jsonb,$1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [id, type, aggregateType, aggregate, scope, JSON.stringify(payload)]
    );
  }

  managePolicy(input: Readonly<{ id: string; scopeId: string; kind: string; rule: Readonly<Record<string, unknown>>; expectedVersion: number | null }>) {
    return this.database.query(
      `insert into finance.policy(id,scope_id,kind,rule,state,version) values($1,$2,$3,$4::jsonb,'active',1)
      on conflict(id) do update set kind=excluded.kind,rule=excluded.rule,state='active',version=finance.policy.version+1
      where finance.policy.scope_id=$2 and ($5::bigint is null or finance.policy.version=$5) returning *`,
      [input.id, input.scopeId, input.kind, JSON.stringify(input.rule), input.expectedVersion]
    );
  }

  async policyGuard(ancestorIds: readonly string[]): Promise<Readonly<{ allowedKinds: readonly string[]; maximumThresholdMinor: number | null }> | null> {
    if (ancestorIds.length === 0) return null;
    const result = await this.database.query<{ allowed_kinds: unknown; maximum_threshold_minor: number | null }>(
      `select coalesce(rule->'allowedKinds','[]'::jsonb) allowed_kinds,
      case when jsonb_typeof(rule->'maximumThresholdMinor')='number' then (rule->>'maximumThresholdMinor')::bigint end::float8 maximum_threshold_minor
      from finance.policy where scope_id=any($1::text[]) and kind='mallfinance' and state='active'
      order by array_position($1::text[],scope_id) limit 1`,
      [ancestorIds]
    );
    const row = result.rows[0];
    if (!row) return null;
    const allowedKinds = Array.isArray(row.allowed_kinds) ? row.allowed_kinds.filter((value): value is string => typeof value === 'string') : [];
    return Object.freeze({ allowedKinds: Object.freeze(allowedKinds), maximumThresholdMinor: row.maximum_threshold_minor });
  }

  manageInvoiceProfile(
    input: Readonly<{
      id: string;
      ownerId: string;
      title: Readonly<{ ciphertext: string; keyVersion: string }>;
      taxid: Readonly<{ ciphertext: string; fingerprint: string; keyVersion: string }>;
      address: Readonly<{ ciphertext: string; keyVersion: string }> | null;
      titleMasked: string;
      taxidMasked: string;
      expectedVersion: number | null;
    }>
  ) {
    return this.database.query(
      `insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
      taxid_key_version,address_ciphertext,address_key_version,title_masked,taxid_masked,status,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',1) on conflict(id) do update set
      title_ciphertext=excluded.title_ciphertext,title_key_version=excluded.title_key_version,taxid_ciphertext=excluded.taxid_ciphertext,
      taxid_token=excluded.taxid_token,taxid_key_version=excluded.taxid_key_version,address_ciphertext=excluded.address_ciphertext,
      address_key_version=excluded.address_key_version,title_masked=excluded.title_masked,taxid_masked=excluded.taxid_masked,
      version=invoice.profile.version+1 where invoice.profile.owner_id=$2
      and ($12::bigint is null or invoice.profile.version=$12) returning id,owner_id,status,version`,
      [
        input.id,
        input.ownerId,
        input.title.ciphertext,
        input.title.keyVersion,
        input.taxid.ciphertext,
        input.taxid.fingerprint,
        input.taxid.keyVersion,
        input.address?.ciphertext ?? null,
        input.address?.keyVersion ?? null,
        input.titleMasked,
        input.taxidMasked,
        input.expectedVersion,
      ]
    );
  }
}
