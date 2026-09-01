import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PriceRuleRecord, RuleRepository } from '../../application/port/RuleRepository';
import type { ContractJsonValue } from '@shop/contract';
interface PriceRuleRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: number;
  readonly kind: string;
  readonly condition: ContractJsonValue;
  readonly effect: ContractJsonValue;
  readonly version: number;
  readonly status: string;
  readonly effective_at: Date | null;
}
export class PgRuleRepository implements RuleRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async create(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      priority: number;
      kind: string;
      condition: ContractJsonValue;
      effect: ContractJsonValue;
    }>
  ): Promise<PriceRuleRecord> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<PriceRuleRow>(
      `insert into pricing.rule(id,scope_id,priority,kind,condition,effect,version,status)
      values($1,$2,$3,$4,$5::jsonb,$6::jsonb,1,'draft')
      returning id,scope_id,priority,kind,condition,effect,version,status,effective_at`,
      [input.id, input.scope, input.priority, input.kind, JSON.stringify(input.condition), JSON.stringify(input.effect)]
    );
    const row = result.rows[0];
    if (!row) throw new Error('PRICE_RULE_CREATE_FAILED');
    return map(row);
  }
  async publish(context: ReadTransactionContext, id: string, expectedVersion: number | undefined): Promise<PriceRuleRecord | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<PriceRuleRow>(
      `update pricing.rule set status='published',effective_at=clock_timestamp()
      where id=$1 and status='draft' and ($2::integer is null or version=$2)
      returning id,scope_id,priority,kind,condition,effect,version,status,effective_at`,
      [id, expectedVersion ?? null]
    );
    const row = result.rows[0];
    return row ? map(row) : null;
  }
}
function map(row: PriceRuleRow): PriceRuleRecord {
  return Object.freeze({ ...row, effective_at: row.effective_at?.toISOString() ?? null });
}
