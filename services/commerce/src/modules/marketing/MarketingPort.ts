import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface MarketingReservation {
  readonly campaign: string;
  readonly member: string;
  readonly order: string;
  readonly scope: string;
  readonly amountMinor: number;
}

export class MarketingPort {
  async reserve(database: OperationDatabase, input: MarketingReservation): Promise<void> {
    const changed = await database.query(`update marketing.campaign set spent_minor=spent_minor+$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$3 and state='active' and budget_minor-spent_minor>=$2 returning id`,
    [input.campaign, input.amountMinor, input.scope]);
    if (!changed.rows[0]) throw new Error('MARKETING_BUDGET_CONFLICT');
    await database.query(`insert into marketing.redemption(id,campaign_id,member_id,order_id,amount_minor,state,idempotency_key,created_at,updated_at)
      values($1,$2,$3,$4,$5,'reserved',$4,clock_timestamp(),clock_timestamp())`,
    [`promotion:${randomUUID()}`, input.campaign, input.member, input.order, input.amountMinor]);
  }

  async commit(database: OperationDatabase, order: string): Promise<void> {
    await database.query(`update marketing.redemption set state='committed',updated_at=clock_timestamp()
      where order_id=$1 and state='reserved'`, [order]);
  }

  async release(database: OperationDatabase, order: string): Promise<void> {
    const campaigns = await database.query<{ campaign_id: string; amount_minor: number }>(`update marketing.redemption
      set state='released',updated_at=clock_timestamp() where order_id=$1 and state='reserved'
      returning campaign_id,amount_minor::float8 amount_minor`, [order]);
    for (const campaign of campaigns.rows) await database.query(`update marketing.campaign
      set spent_minor=greatest(0,spent_minor-$2),version=version+1,updated_at=clock_timestamp() where id=$1`,
    [campaign.campaign_id, campaign.amount_minor]);
  }
}

export const marketingPort = new MarketingPort();
