import { type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { FinancePolicyView, PolicyRepository } from '../../application/port/PolicyRepository';

export class PgPolicyRepository implements PolicyRepository {
  constructor(private readonly database: SqlExecutor) {}

  async read(scopeIds: readonly string[], status: string | null, cursor: string | null, limit: number): Promise<readonly FinancePolicyView[]> {
    const result = await this.database.query<FinancePolicyView>(
      `select id,name,state status,trigger,entries,"effective_at" "effectiveAt","expires_at" "expiresAt",version
      from finance.policy where scope_id=any($1::text[]) and ($2::text is null or state=$2)
      and ($3::text is null or id>$3) order by id limit $4`,
      [scopeIds, status, cursor, limit]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async affected(scopeIds: readonly string[], from: string, to: string): Promise<number> {
    const result = await this.database.query<{ count: number }>(`select count(*)::float8 count from finance.journal where scope_id=any($1::text[]) and posted_at>=$2 and posted_at<$3`, [scopeIds, from, to]);
    return result.rows[0]?.count ?? 0;
  }

  manage(
    input: Readonly<{
      id: string;
      scopeId: string;
      kind: string;
      rule: Readonly<Record<string, unknown>>;
      state: 'active' | 'retired';
      name: string;
      trigger: string;
      entries: readonly unknown[];
      effectiveAt: string;
      expiresAt: string | null;
      expectedVersion: number | null;
    }>
  ) {
    return this.database.query(
      `insert into finance.policy(id,scope_id,kind,rule,state,version,name,"trigger",entries,effective_at,expires_at,updated_at)
      values($1,$2,$3,$4::jsonb,$5,1,$6,$7,$8::jsonb,$9,$10,clock_timestamp())
      on conflict(id) do update set kind=excluded.kind,rule=excluded.rule,state=excluded.state,name=excluded.name,"trigger"=excluded."trigger",
        entries=excluded.entries,effective_at=excluded.effective_at,expires_at=excluded.expires_at,updated_at=clock_timestamp(),version=finance.policy.version+1
      where finance.policy.scope_id=$2 and ($11::bigint is null or finance.policy.version=$11)
      returning id,scope_id,kind,rule,state,version`,
      [input.id, input.scopeId, input.kind, JSON.stringify(input.rule), input.state, input.name, input.trigger, JSON.stringify(input.entries), input.effectiveAt, input.expiresAt, input.expectedVersion]
    );
  }

  async guard(ancestorIds: readonly string[]): Promise<Readonly<{ allowedKinds: readonly string[]; maximumThresholdMinor: number | null }> | null> {
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
}
