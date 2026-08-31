import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface OrderSummary {
  readonly total: number;
  readonly awaitingPayment: number;
  readonly fulfilling: number;
  readonly aftersale: number;
  readonly version: number;
}

export interface OrderReadPort {
  summary(scope: ReadScope, member: string, mall: string): Promise<OrderSummary>;
}

interface OrderRow extends QueryResultRow {
  readonly total: number;
  readonly awaiting_payment: number;
  readonly fulfilling: number;
  readonly aftersale: number;
  readonly version: number;
}

export class PgOrderReadPort implements OrderReadPort {
  private readonly reads: ReadSession;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.reads = new ReadSession(pool, workload);
  }
  summary(scope: ReadScope, member: string, mall: string): Promise<OrderSummary> {
    return this.reads.run(scope, async (database) => {
      const result = await database.query<OrderRow>(
        `select count(*)::integer total,count(*) filter(where lifecycle_state='awaitingpayment')::integer awaiting_payment,
        count(*) filter(where lifecycle_state in('paid','fulfilling','shipped'))::integer fulfilling,
        count(*) filter(where aftersale_state not in('none','resolved','rejected'))::integer aftersale,
        coalesce(max(version),0)::bigint version from ordering.orderrecord where member_id=$1 and mall_id=$2`,
        [member, mall]
      );
      const row = result.rows[0]!;
      return Object.freeze({ total: Number(row.total), awaitingPayment: Number(row.awaiting_payment), fulfilling: Number(row.fulfilling), aftersale: Number(row.aftersale), version: Number(row.version) });
    });
  }
}

export const ORDER_READ_PORT = publicPort<OrderReadPort>('order', 'read');
