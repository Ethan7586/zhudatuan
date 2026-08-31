import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface FinanceStatement {
  readonly id: string;
  readonly scope: string;
  readonly objectRef: string;
  readonly sha256: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}
export interface FinanceChannelPort {
  statement(database: OperationDatabase, id: string, scope: string): Promise<FinanceStatement | null>;
}
export const FINANCE_CHANNEL_PORT = publicPort<FinanceChannelPort>('channel', 'finance');

export class PgFinanceChannelPort implements FinanceChannelPort {
  async statement(database: OperationDatabase, id: string, scope: string): Promise<FinanceStatement | null> {
    const result = await database.query<{ id: string; scope: string; objectRef: string; sha256: string; periodStart: string; periodEnd: string }>(
      `select id,scope_id scope,object_ref "objectRef",sha256,period_start::text "periodStart",period_end::text "periodEnd"
      from channel.statement where id=$1 and scope_id=$2`,
      [id, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
