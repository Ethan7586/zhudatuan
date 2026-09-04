import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { EventReplayPort, RuntimeReplayEvent, RuntimeReplayPage } from '../../public';

interface ReplayRow {
  readonly id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly scope_id: string;
  readonly aggregate_id: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurred_at: string;
  readonly realtime_cursor: string;
}

export class PgEventReplayPort implements EventReplayPort {
  private readonly transactions = new PgTransactionAccess();

  async after(context: ReadTransactionContext, input: Readonly<{ cursor: string; scopes: readonly string[]; prefix: string; limit: number }>): Promise<RuntimeReplayPage | null> {
    if (!input.prefix || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100_000) throw new Error('EVENT_REPLAY_INPUT_INVALID');
    const database = this.transactions.database(context);
    const anchor = await database.query<{ realtime_published_at: string; id: string }>(
      `select realtime_published_at,id from runtime.outbox where realtime_cursor=$1 and scope_id=any($2::text[])
      and event_type like $3 and realtime_published_at is not null order by realtime_published_at desc,id desc limit 1`,
      [input.cursor, input.scopes, `${input.prefix}%`]
    );
    const start = anchor.rows[0];
    if (!start) return null;
    const result = await database.query<ReplayRow>(
      `select id,event_type,event_version,scope_id,aggregate_id,payload,occurred_at,realtime_cursor from runtime.outbox
      where scope_id=any($1::text[]) and event_type like $2 and realtime_cursor is not null
      and (realtime_published_at,id)>($3::timestamptz,$4)
      order by realtime_published_at,id limit $5`,
      [input.scopes, `${input.prefix}%`, start.realtime_published_at, start.id, input.limit + 1]
    );
    const rows = result.rows.slice(0, input.limit);
    const events: readonly RuntimeReplayEvent[] = Object.freeze(rows.map((row) => Object.freeze({
      id: row.id,
      type: row.event_type,
      version: Number(row.event_version),
      scope: row.scope_id,
      aggregate: row.aggregate_id,
      payload: Object.freeze({ ...row.payload }),
      occurredAt: new Date(row.occurred_at).toISOString(),
      cursor: row.realtime_cursor,
    })));
    return Object.freeze({ events, resumeCursor: rows.at(-1)?.realtime_cursor ?? null, overflow: result.rows.length > input.limit });
  }

  async publishedReferences(context: ReadTransactionContext, input: Readonly<{ type: string; field: string; references: readonly string[]; excluding: string | null }>): Promise<readonly string[]> {
    if (!/^[a-z][a-z0-9.]{2,127}$/.test(input.type) || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(input.field)) throw new Error('EVENT_REFERENCE_INPUT_INVALID');
    if (input.references.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{ reference: string }>(
      `select distinct payload->>$2 reference from runtime.outbox where event_type=$1 and payload->>$2=any($3::text[])
      and realtime_published_at is not null and ($4::text is null or id<>$4) order by reference`,
      [input.type, input.field, input.references, input.excluding]
    );
    return Object.freeze(result.rows.map(({ reference }) => reference));
  }
}
