import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { QualificationProfile, QualificationPolicy, CheckoutQualificationPort } from '../../public/CheckoutQualificationPort';
export class PgCheckoutQualificationPort implements CheckoutQualificationPort {
  private readonly transactions = new PgTransactionAccess();
  async profile(context: ReadTransactionContext, member: string, scope: string): Promise<QualificationProfile | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      status: string;
      version: number;
      city: string | null;
    }>(`select status,version::integer version,city_code city from qualification.profile where member_id=$1 and scope_id=$2`, [member, scope]);
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
  async policies(context: ReadTransactionContext, scope: string): Promise<readonly QualificationPolicy[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      version: number;
      hash: string;
      rule: Record<string, unknown>;
      resources: readonly Readonly<{
        kind: string;
        id: string;
      }>[];
      subjects: readonly Readonly<Record<string, unknown>>[];
      period: string | null;
      quantity: number | null;
      amountMinor: number | null;
    }>(
      `select policy.id,policy.active_version version,version.rule_hash hash,version.rule,
      coalesce((select jsonb_agg(jsonb_build_object('kind',resource.kind,'id',resource.resource_id)
        order by resource.kind,resource.resource_id) from qualification.resource resource
        where resource.policy_id=policy.id and resource.policy_version=policy.active_version),'[]') resources,
      coalesce((select jsonb_agg(subject.selector order by subject.kind,subject.selector::text)
        from qualification.subject subject where subject.policy_id=policy.id
        and subject.policy_version=policy.active_version),'[]') subjects,
      limits.period,limits.quantity::float8 quantity,limits.amount_minor::float8 "amountMinor"
      from qualification.policy policy join qualification.policyversion version
        on version.policy_id=policy.id and version.version=policy.active_version
      left join lateral(select period,quantity,amount_minor from qualification.purchaselimit
        where policy_id=policy.id and policy_version=policy.active_version order by period limit 1) limits on true
      where policy.scope_id=$1 and policy.status='published' order by policy.id`,
      [scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async tags(context: ReadTransactionContext, member: string): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      code: string;
    }>(
      `select code from qualification.tag where member_id=$1 and (effective_at is null or effective_at<=clock_timestamp())
      and (expires_at is null or expires_at>clock_timestamp()) order by code`,
      [member]
    );
    return Object.freeze(result.rows.map(({ code }) => code));
  }
}
