import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AfterSaleCandidate, AfterSaleDecision, AfterSalePolicyPort } from '../../public/AfterSalePolicyPort';
export class PgAfterSalePolicyPort implements AfterSalePolicyPort {
  private readonly transactions = new PgTransactionAccess();
  async evaluate(context: ReadTransactionContext, candidate: AfterSaleCandidate): Promise<AfterSaleDecision> {
    const database = this.transactions.database(context);
    const configured = (
      await database.query<{
        id: string;
        version: number;
        rule: Record<string, unknown>;
      }>(
        `select policy.id,policy.active_version::float8 version,version.rule->'aftersale' rule
        from qualification.policy policy join qualification.policyversion version
          on version.policy_id=policy.id and version.version=policy.active_version
        where policy.scope_id=$1 and policy.status='published' and version.rule?'aftersale'
        order by policy.id limit 1`,
        [candidate.scope]
      )
    ).rows[0];
    const policy = object(configured?.rule);
    const provider = object(object(policy.providers)[candidate.provider ?? 'internal']);
    const source = Object.freeze({ ...policy, ...provider, ...candidate.providerRule });
    const windowDays = integer(source.windowDays, 7, 0, 3650);
    const maximumQuantity = Math.max(0, candidate.fulfilledQuantity - candidate.claimedQuantity);
    const fulfilled = candidate.fulfilledAt === null ? null : new Date(candidate.fulfilledAt);
    const deadline = fulfilled && Number.isFinite(fulfilled.getTime()) ? new Date(fulfilled.getTime() + windowDays * 86400000).toISOString() : null;
    const returnable = source.returnable !== false;
    const expired = deadline !== null && Date.parse(deadline) < Date.now();
    const unavailableReason =
      candidate.fulfilledAt === null
        ? 'NOT_FULFILLED'
        : !returnable
          ? 'PROVIDER_NOT_RETURNABLE'
          : maximumQuantity === 0
            ? 'QUANTITY_EXHAUSTED'
            : candidate.requestedQuantity > maximumQuantity
              ? 'QUANTITY_EXCEEDED'
              : expired
                ? 'AFTERSALE_WINDOW_EXPIRED'
                : null;
    const nonPhysical = ['digital', 'virtual', 'voucher', 'service'].includes(candidate.productType.toLowerCase());
    const requiresReturn = typeof source.requiresReturn === 'boolean' ? source.requiresReturn : !nonPhysical;
    return Object.freeze({
      eligible: unavailableReason === null,
      requiresReturn,
      maximumQuantity,
      windowDays,
      deadline,
      unavailableReason,
      policy: Object.freeze({ id: configured?.id ?? 'default', policyVersion: configured?.version ?? 0, rule: source }),
    });
  }
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function integer(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : fallback;
}
