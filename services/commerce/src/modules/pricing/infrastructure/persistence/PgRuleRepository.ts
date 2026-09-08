import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { PriceRuleRecord, RuleRepository } from '../../application/port/RuleRepository';
import { PricingRule, type PricingRuleSnapshot } from '../../domain/model/PricingRule';
import type { ContractJsonObject } from '@shop/contract';
interface PriceRuleRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: number;
  readonly kind: PricingRuleSnapshot['kind'];
  readonly condition: ContractJsonObject;
  readonly effect: ContractJsonObject;
  readonly version: number;
  readonly status: PricingRuleSnapshot['state'];
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly approved_by: string | null;
}
export class PgRuleRepository implements RuleRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async create(context: WriteTransactionContext, input: Parameters<RuleRepository['create']>[1]): Promise<PriceRuleRecord> {
    const database = this.transactions.database(context);
    const rule = PricingRule.draft(input).snapshot();
    const result = await database.query<PriceRuleRow>(
      `insert into pricing.rule(id,scope_id,priority,kind,condition,effect,version,status,effective_at,expires_at,approved_by)
      values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11)
      returning id,scope_id,priority,kind,condition,effect,version,status,effective_at,expires_at,approved_by`,
      [rule.id, rule.scope, rule.priority, rule.kind, JSON.stringify(rule.condition), JSON.stringify(rule.effect), rule.version, rule.state, rule.effectiveAt, rule.expiresAt, rule.approvedBy]
    );
    const row = result.rows[0];
    if (!row) throw new Error('PRICE_RULE_CREATE_FAILED');
    return map(row);
  }
  async publish(context: WriteTransactionContext, id: string, expectedVersion: number, approvedBy: string): Promise<PriceRuleRecord | null> {
    const database = this.transactions.database(context);
    const loaded = await database.query<PriceRuleRow>(
      `select id,scope_id,priority,kind,condition,effect,version,status,effective_at,expires_at,approved_by
       from pricing.rule where id=$1 for update`,
      [id]
    );
    if (!loaded.rows[0]) return null;
    const published = PricingRule.restore(snapshot(loaded.rows[0])).publish(expectedVersion, approvedBy, new Date()).snapshot();
    const result = await database.query<PriceRuleRow>(
      `update pricing.rule set status=$2,version=$3,approved_by=$4 where id=$1 and version=$5 and status='draft'
       returning id,scope_id,priority,kind,condition,effect,version,status,effective_at,expires_at,approved_by`,
      [id, published.state, published.version, published.approvedBy, expectedVersion]
    );
    const row = result.rows[0];
    return row ? map(row) : null;
  }
}
function map(row: PriceRuleRow): PriceRuleRecord {
  const value = snapshot(row);
  return Object.freeze({
    id: value.id,
    scope_id: value.scope,
    priority: value.priority,
    kind: value.kind,
    condition: value.condition as ContractJsonObject,
    effect: value.effect as ContractJsonObject,
    version: value.version,
    status: value.state,
    effective_at: value.effectiveAt,
    expires_at: value.expiresAt,
    approved_by: value.approvedBy,
  });
}
function snapshot(row: PriceRuleRow): PricingRuleSnapshot {
  return Object.freeze({
    id: row.id,
    scope: row.scope_id,
    priority: Number(row.priority),
    kind: row.kind,
    condition: Object.freeze({ ...row.condition }),
    effect: Object.freeze({ ...row.effect }),
    version: Number(row.version),
    state: row.status,
    effectiveAt: iso(row.effective_at),
    expiresAt: row.expires_at === null ? null : iso(row.expires_at),
    approvedBy: row.approved_by,
  });
}
function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
