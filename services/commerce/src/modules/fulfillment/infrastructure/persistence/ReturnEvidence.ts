import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { AfterSaleReturnEvidence } from '../../../order/public';

export async function readReturnEvidence(
  database: ReturnType<PgTransactionAccess['database']>,
  aftersale: string
): Promise<readonly AfterSaleReturnEvidence[]> {
  const result = await database.query<{
    id: string;
    state: string;
    provider: string | null;
    providerReference: string | null;
    trackingNumber: string | null;
    instruction: Record<string, unknown>;
    version: number;
  }>(
    `select id,state,provider,provider_reference "providerReference",tracking_number "trackingNumber",instruction,version::float8 version
    from fulfillment.returnrecord where aftersale_id=$1 order by id`,
    [aftersale]
  );
  return Object.freeze(result.rows.map((row) => Object.freeze(row)));
}
