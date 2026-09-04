import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

export async function nextOrderNumber(database: SqlExecutor): Promise<string> {
  const row = (
    await database.query<{ number: string }>(`select 'SW'||to_char(clock_timestamp(),'YYYYMMDD')||
      lpad(nextval('ordering.order_number_seq')::text,12,'0') number`)
  ).rows[0];
  if (!row) throw new Error('ORDER_NUMBER_GENERATION_FAILED');
  return row.number;
}
