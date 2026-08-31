import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface QualificationProfile {
  readonly status: string;
  readonly version: number;
  readonly city: string | null;
}
export interface QualificationPolicy {
  readonly id: string;
  readonly version: number;
  readonly hash: string;
  readonly rule: Record<string, unknown>;
  readonly resources: readonly Readonly<{ kind: string; id: string }>[];
  readonly subjects: readonly Readonly<Record<string, unknown>>[];
  readonly period: string | null;
  readonly quantity: number | null;
  readonly amountMinor: number | null;
}
export interface CheckoutQualificationPort {
  profile(database: OperationDatabase, member: string, scope: string): Promise<QualificationProfile | null>;
  policies(database: OperationDatabase, scope: string): Promise<readonly QualificationPolicy[]>;
  tags(database: OperationDatabase, member: string): Promise<readonly string[]>;
}
export const CHECKOUT_QUALIFICATION_PORT = publicPort<CheckoutQualificationPort>('qualification', 'checkout');

export class PgCheckoutQualificationPort implements CheckoutQualificationPort {
  async profile(database: OperationDatabase, member: string, scope: string): Promise<QualificationProfile | null> {
    const result = await database.query<{ status: string; version: number; city: string | null }>(`select status,version::integer version,city_code city from qualification.profile where member_id=$1 and scope_id=$2`, [member, scope]);
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }

  async policies(database: OperationDatabase, scope: string): Promise<readonly QualificationPolicy[]> {
    const result = await database.query<{
      id: string;
      version: number;
      hash: string;
      rule: Record<string, unknown>;
      resources: readonly Readonly<{ kind: string; id: string }>[];
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

  async tags(database: OperationDatabase, member: string): Promise<readonly string[]> {
    const result = await database.query<{ code: string }>(
      `select code from qualification.tag where member_id=$1 and (effective_at is null or effective_at<=clock_timestamp())
      and (expires_at is null or expires_at>clock_timestamp()) order by code`,
      [member]
    );
    return Object.freeze(result.rows.map(({ code }) => code));
  }
}
