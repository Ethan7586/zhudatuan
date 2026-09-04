import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { SettlementOutcome, SettlementReceipt } from '../../application/port/CommissionSettlementProcess';

export async function recordSettlementReceipt(
  transaction: SqlExecutor,
  scope: string,
  source: 'commission' | 'withdrawal',
  id: string,
  version: number,
  outcome: SettlementOutcome,
  reference: string | null,
  error: string | null
): Promise<SettlementReceipt> {
  await transaction.query(
    `insert into referral.settlementreceipt(id,scope_id,source_type,source_id,source_version,outcome,reference,error_code,attempts,observed_at)
    values('referralsettlementreceipt:'||gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,1,clock_timestamp())
    on conflict(scope_id,source_type,source_id,source_version,outcome) do update set reference=excluded.reference,error_code=excluded.error_code,
    attempts=referral.settlementreceipt.attempts+1,observed_at=excluded.observed_at`,
    [scope, source, id, version, outcome, reference, error]
  );
  return Object.freeze({ source, id, outcome, reference, error });
}

export function settlementError(error: unknown): string {
  const value = error instanceof Error ? error.message : '';
  return /^[A-Z][A-Z0-9_]{2,100}$/.test(value) ? value : 'REFERRAL_FINANCE_UNAVAILABLE';
}
