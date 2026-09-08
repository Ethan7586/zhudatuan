import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrderSupportAction, OrderSupportPort, OrderSupportSummary } from '../../public/OrderSupportPort';

interface SummaryRow {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly order_number: string;
  readonly lifecycle_state: string;
  readonly total_minor: number;
}
interface ActionRow {
  readonly id: string;
  readonly order_id: string;
  readonly aftersale_id: string | null;
  readonly support_case_id: string;
  readonly kind: 'caseopened';
  readonly created_at: string;
}

export class PgOrderSupportPort implements OrderSupportPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async find(context: ReadTransactionContext, order: string, scopes: readonly string[], member: string, memberOnly: boolean): Promise<OrderSupportSummary | null> {
    const result = await this.transactions.database(context).query<SummaryRow>(
      `select target.id,target.scope_id,target.member_id,target.order_number,target.lifecycle_state,target.total_minor::float8 total_minor
      from ordering.orderrecord target where target.id=$1 and (($4=false and target.scope_id=any($2::text[])) or target.member_id=$3)`,
      [order, scopes, member, memberOnly]
    );
    return result.rows[0] ? summary(result.rows[0]) : null;
  }

  async recent(context: ReadTransactionContext, scopes: readonly string[], member: string, memberOnly: boolean, limit = 5): Promise<readonly OrderSupportSummary[]> {
    const result = await this.transactions.database(context).query<SummaryRow>(
      `select target.id,target.scope_id,target.member_id,target.order_number,target.lifecycle_state,target.total_minor::float8 total_minor
      from ordering.orderrecord target where (($3=false and target.scope_id=any($1::text[])) or target.member_id=$2)
      and target.member_id=$2 order by target.created_at desc,target.id desc limit $4`,
      [scopes, member, memberOnly, Math.min(Math.max(limit, 1), 10)]
    );
    return Object.freeze(result.rows.map(summary));
  }

  async collaborate(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; order: string; supportCase: string; scopes: readonly string[]; member: string; memberOnly: boolean; actor: string; trace: string }>
  ): Promise<OrderSupportAction> {
    const order = await this.find(context, input.order, input.scopes, input.member, input.memberOnly);
    if (!order) throw new DomainError('RESOURCE_NOT_FOUND');
    const result = await this.transactions.database(context).query<ActionRow>(
      `insert into ordering.supportcollaboration(id,order_id,aftersale_id,support_case_id,scope_id,member_id,kind,actor_id,evidence,created_at)
      values($1,$2,(select id from ordering.aftersale where order_id=$2 order by created_at desc,id desc limit 1),$3,$4,$5,'caseopened',$6,$7::jsonb,clock_timestamp())
      on conflict(support_case_id) do nothing
      returning id,order_id,aftersale_id,support_case_id,kind,created_at`,
      [input.id, order.id, input.supportCase, order.scope, order.member, input.actor, JSON.stringify({ source: 'support', trace: input.trace })]
    );
    const created =
      result.rows[0] ??
      (
        await this.transactions.database(context).query<ActionRow>(
          `select id,order_id,aftersale_id,support_case_id,kind,created_at from ordering.supportcollaboration
      where support_case_id=$1 and order_id=$2`,
          [input.supportCase, order.id]
        )
      ).rows[0];
    if (!created) throw new DomainError('VERSION_CONFLICT');
    return action(created);
  }
}

function summary(row: SummaryRow): OrderSupportSummary {
  return Object.freeze({ id: row.id, scope: row.scope_id, member: row.member_id, number: row.order_number, state: row.lifecycle_state, totalMinor: Number(row.total_minor) });
}

function action(row: ActionRow): OrderSupportAction {
  return Object.freeze({ id: row.id, order: row.order_id, aftersale: row.aftersale_id, supportCase: row.support_case_id, kind: row.kind, createdAt: new Date(row.created_at).toISOString() });
}
