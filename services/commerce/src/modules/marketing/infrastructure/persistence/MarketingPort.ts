import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import type { MarketingReservation } from '../../public/MarketingReservation';
export class MarketingPort {
  private readonly transactions = new PgTransactionAccess();
  async references(context: ReadTransactionContext, campaigns: readonly string[]): Promise<boolean> {
    const database = this.transactions.database(context);
    if (campaigns.length === 0) return true;
    const result = await database.query<{
      count: number;
    }>(
      `select count(*)::integer count from marketing.campaign where id=any($1::text[]) and state='active'
      and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())`,
      [campaigns]
    );
    return result.rows[0]?.count === campaigns.length;
  }
  async campaigns(context: ReadTransactionContext, scope: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      version: number;
      rule: Record<string, unknown>;
      remainingBudget: number;
    }>(
      `select id,version::integer version,rule,(budget_minor-spent_minor)::float8 "remainingBudget"
      from marketing.campaign where scope_id=$1 and state='active' and effective_at<=clock_timestamp()
      and (expires_at is null or expires_at>clock_timestamp()) and budget_minor>spent_minor order by id`,
      [scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async reserve(context: WriteTransactionContext, input: MarketingReservation): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update marketing.campaign set spent_minor=spent_minor+$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$3 and state='active' and budget_minor-spent_minor>=$2 returning id`,
      [input.campaign, input.amountMinor, input.scope]
    );
    if (!changed.rows[0]) throw new Error('MARKETING_BUDGET_CONFLICT');
    await database.query(
      `insert into marketing.redemption(id,campaign_id,member_id,order_id,amount_minor,state,idempotency_key,created_at,updated_at)
      values($1,$2,$3,$4,$5,'reserved',$4,clock_timestamp(),clock_timestamp())`,
      [`promotion:${randomUUID()}`, input.campaign, input.member, input.order, input.amountMinor]
    );
  }
  async commit(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update marketing.redemption set state='committed',updated_at=clock_timestamp()
      where order_id=$1 and state='reserved'`,
      [order]
    );
  }
  async release(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const campaigns = await database.query<{
      campaign_id: string;
      amount_minor: number;
    }>(
      `update marketing.redemption
      set state='released',updated_at=clock_timestamp() where order_id=$1 and state='reserved'
      returning campaign_id,amount_minor::float8 amount_minor`,
      [order]
    );
    for (const campaign of campaigns.rows)
      await database.query(
        `update marketing.campaign
      set spent_minor=greatest(0,spent_minor-$2),version=version+1,updated_at=clock_timestamp() where id=$1`,
        [campaign.campaign_id, campaign.amount_minor]
      );
  }
}
