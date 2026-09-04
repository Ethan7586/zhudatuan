import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { BudgetExpiryRepository } from '../../application/port/BudgetExpiryRepository';
import { Budget } from '../../domain/model/Budget';
import type { MarketingRefund, MarketingReservation, MarketingReservePort } from '../../public';

interface ReservationRow extends Record<string, unknown> {
  readonly id: string;
  readonly campaign_id: string;
  readonly member_id: string;
  readonly order_id: string;
  readonly amount_minor: number;
  readonly restored_minor: number;
  readonly state: 'reserved' | 'committed' | 'released' | 'refunded';
  readonly campaign_version: number;
  readonly expires_at: Date | string;
  readonly version: number;
  readonly scope_id: string;
}

export class PgMarketingReservePort implements MarketingReservePort, BudgetExpiryRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async reserve(context: WriteTransactionContext, input: MarketingReservation): Promise<void> {
    validateReservation(input);
    const database = this.transactions.database(context);
    const reservation = `promotion:${digest(`${input.campaign}:${input.order}`)}`;
    const inserted = await database.query<ReservationRow>(
      `insert into marketing.redemption(id,campaign_id,member_id,order_id,amount_minor,restored_minor,state,idempotency_key,
       campaign_version,expires_at,version,created_at,updated_at) values($1,$2,$3,$4,$5,0,'reserved',$4,$6,$7,1,clock_timestamp(),clock_timestamp())
       on conflict(campaign_id,order_id) do nothing returning id,campaign_id,member_id,order_id,amount_minor::float8 amount_minor,
       restored_minor::float8 restored_minor,state,campaign_version::integer,expires_at,version::integer,$8::text scope_id`,
      [reservation, input.campaign, input.member, input.order, input.amountMinor, input.campaignVersion, input.expiresAt, input.scope]
    );
    if (!inserted.rows[0]) {
      const replay = await existing(database, input.campaign, input.order, input.scope);
      if (replay && replay.member_id === input.member && replay.amount_minor === input.amountMinor && replay.campaign_version === input.campaignVersion && ['reserved', 'committed'].includes(replay.state)) return;
      throw new DomainError('MARKETING_BUDGET_CONFLICT');
    }
    const changed = await database.query<{ budget_minor: number; spent_minor: number; budget_version: number }>(
      `update marketing.campaign set spent_minor=spent_minor+$3,budget_version=budget_version+1,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and version=$4 and state in('scheduled','active') and effective_at<=clock_timestamp()
       and (expires_at is null or expires_at>clock_timestamp()) and budget_minor-spent_minor>=$3
       returning budget_minor::float8 budget_minor,spent_minor::float8 spent_minor,budget_version::integer`,
      [input.campaign, input.scope, input.amountMinor, input.campaignVersion]
    );
    const budget = changed.rows[0];
    if (!budget) throw new DomainError('MARKETING_BUDGET_CONFLICT');
    Budget.restore({ campaign: input.campaign, limitMinor: Number(budget.budget_minor), spentMinor: Number(budget.spent_minor), version: Number(budget.budget_version) });
    const runtime = new PgRuntimeWriter(database);
    await runtime.schedule({ id: `job:marketingbudgetexpiry:${digest(reservation)}`, kind: 'marketingbudgetexpiry', owner: 'marketing', scope: input.scope, availableAt: input.expiresAt, payload: { order: input.order }, priority: 10 });
    await runtime.append(event('marketing.promotion.reserved', inserted.rows[0], context.trace, input.amountMinor));
  }

  async commit(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const rows = await database.query<ReservationRow>(
      `update marketing.redemption redemption set state='committed',version=version+1,updated_at=clock_timestamp()
       from marketing.campaign campaign where redemption.campaign_id=campaign.id and redemption.order_id=$1 and redemption.state='reserved'
       returning redemption.id,redemption.campaign_id,redemption.member_id,redemption.order_id,redemption.amount_minor::float8 amount_minor,
       redemption.restored_minor::float8 restored_minor,redemption.state,redemption.campaign_version::integer,redemption.expires_at,
       redemption.version::integer,campaign.scope_id`,
      [order]
    );
    await append(database, rows.rows, 'marketing.promotion.committed', context.trace);
  }

  async release(context: WriteTransactionContext, order: string): Promise<void> {
    await this.releaseRows(context, order, null);
  }

  async expire(context: WriteTransactionContext, order: string, at: Date): Promise<void> {
    await this.releaseRows(context, order, at);
  }

  async refund(context: WriteTransactionContext, input: MarketingRefund): Promise<void> {
    if (!input.refund || !input.order || !Number.isSafeInteger(input.refundedMinor) || !Number.isSafeInteger(input.capturedMinor) || input.refundedMinor < 0 || input.capturedMinor < 1 || input.refundedMinor > input.capturedMinor) {
      throw new Error('MARKETING_REFUND_INVALID');
    }
    const database = this.transactions.database(context);
    const locked = await database.query<ReservationRow>(
      `select redemption.id,redemption.campaign_id,redemption.member_id,redemption.order_id,
       redemption.amount_minor::float8 amount_minor,redemption.restored_minor::float8 restored_minor,redemption.state,
       redemption.campaign_version::integer,redemption.expires_at,redemption.version::integer,campaign.scope_id
       from marketing.redemption redemption join marketing.campaign campaign on campaign.id=redemption.campaign_id
       where redemption.order_id=$1 and redemption.state in('committed','refunded') order by redemption.campaign_id for update of redemption,campaign`,
      [input.order]
    );
    const changes = locked.rows.flatMap((row) => {
      const target = input.refundedMinor === input.capturedMinor ? row.amount_minor : Math.floor((row.amount_minor * input.refundedMinor) / input.capturedMinor);
      const amount = target - row.restored_minor;
      return amount <= 0 ? [] : [{ id: row.id, campaign: row.campaign_id, amount, restored: target, version: row.version + 1, state: target === row.amount_minor ? 'refunded' : 'committed' }];
    });
    if (changes.length === 0) return;
    await database.query(
      `update marketing.redemption target set restored_minor=input.restored,state=input.state,version=input.version,updated_at=clock_timestamp()
       from jsonb_to_recordset($1::jsonb) input(id text,restored bigint,state text,version bigint) where target.id=input.id`,
      [JSON.stringify(changes)]
    );
    await replenish(database, changes);
    const byId = new Map(locked.rows.map((row) => [row.id, row]));
    await append(
      database,
      changes.map((change) => ({ ...byId.get(change.id)!, state: change.state as ReservationRow['state'], restored_minor: change.restored, version: change.version })),
      'marketing.promotion.refunded',
      context.trace,
      new Map(changes.map((change) => [change.id, change.amount]))
    );
  }

  private async releaseRows(context: WriteTransactionContext, order: string, expiredAt: Date | null): Promise<void> {
    const database = this.transactions.database(context);
    const rows = await database.query<ReservationRow>(
      `update marketing.redemption redemption set state='released',version=version+1,updated_at=clock_timestamp()
       from marketing.campaign campaign where redemption.campaign_id=campaign.id and redemption.order_id=$1 and redemption.state='reserved'
       and ($2::timestamptz is null or redemption.expires_at<=$2) returning redemption.id,redemption.campaign_id,redemption.member_id,
       redemption.order_id,redemption.amount_minor::float8 amount_minor,redemption.restored_minor::float8 restored_minor,
       redemption.state,redemption.campaign_version::integer,redemption.expires_at,redemption.version::integer,campaign.scope_id`,
      [order, expiredAt?.toISOString() ?? null]
    );
    if (rows.rows.length === 0) return;
    await replenish(
      database,
      rows.rows.map((row) => ({ campaign: row.campaign_id, amount: row.amount_minor }))
    );
    await append(database, rows.rows, 'marketing.promotion.released', context.trace);
  }
}

async function existing(database: SqlExecutor, campaign: string, order: string, scope: string): Promise<ReservationRow | null> {
  const result = await database.query<ReservationRow>(
    `select redemption.id,redemption.campaign_id,redemption.member_id,redemption.order_id,redemption.amount_minor::float8 amount_minor,
     redemption.restored_minor::float8 restored_minor,redemption.state,redemption.campaign_version::integer,redemption.expires_at,
     redemption.version::integer,campaign.scope_id from marketing.redemption redemption join marketing.campaign campaign
     on campaign.id=redemption.campaign_id where redemption.campaign_id=$1 and redemption.order_id=$2 and campaign.scope_id=$3`,
    [campaign, order, scope]
  );
  return result.rows[0] ?? null;
}
async function replenish(database: SqlExecutor, changes: readonly Readonly<{ campaign: string; amount: number }>[]): Promise<void> {
  const result = await database.query(
    `with amounts as(select campaign,sum(amount)::bigint value from jsonb_to_recordset($1::jsonb)
     input(campaign text,amount bigint) group by campaign)
     update marketing.campaign target set spent_minor=target.spent_minor-amounts.value,budget_version=target.budget_version+1,
     updated_at=clock_timestamp() from amounts where target.id=amounts.campaign and target.spent_minor>=amounts.value returning target.id`,
    [JSON.stringify(changes)]
  );
  if (result.rows.length !== new Set(changes.map(({ campaign }) => campaign)).size) throw new DomainError('MARKETING_BUDGET_CONFLICT');
}
async function append(database: SqlExecutor, rows: readonly ReservationRow[], type: PromotionEvent, trace: string, amounts?: ReadonlyMap<string, number>): Promise<void> {
  await new PgRuntimeWriter(database).appendMany(rows.map((row) => event(type, row, trace, amounts?.get(row.id) ?? row.amount_minor)));
}
type PromotionEvent = 'marketing.promotion.reserved' | 'marketing.promotion.committed' | 'marketing.promotion.released' | 'marketing.promotion.refunded';
function event(type: PromotionEvent, row: ReservationRow, trace: string, amountMinor: number) {
  return {
    id: `event:${randomUUID()}`,
    type,
    aggregateType: 'promotion',
    aggregate: row.id,
    scope: row.scope_id,
    trace,
    payload: { reservation: row.id, campaign: row.campaign_id, member: row.member_id, order: row.order_id, amountMinor, campaignVersion: row.campaign_version },
  };
}
function validateReservation(input: MarketingReservation): void {
  if (
    !input.campaign ||
    !input.member ||
    !input.order ||
    !input.scope ||
    !Number.isSafeInteger(input.campaignVersion) ||
    input.campaignVersion < 1 ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor < 1 ||
    Date.parse(input.expiresAt) <= Date.now()
  ) {
    throw new Error('MARKETING_RESERVATION_INVALID');
  }
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
