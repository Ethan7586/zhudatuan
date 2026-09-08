import { createHash } from 'node:crypto';
import type { ApprovalPort } from '../../../approval/public';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReconciliationOutcome } from '../../application/port/ReconciliationProcess';
import type { ReconciliationReviewPort } from '../../application/port/ReconciliationReviewPort';
import type { ReconciliationReviewRoute } from '../../domain/policy/ReconciliationPolicy';

interface ReviewState {
  readonly state: string;
  readonly version: number | string;
  readonly approval_instance_id: string | null;
}

/** Persists the policy route atomically; it never writes Journal, Entry or Account. */
export class PgReconciliationReview implements ReconciliationReviewPort {
  private readonly access = new PgTransactionAccess();

  constructor(
    private readonly transactions: TransactionManager,
    private readonly approvals: ApprovalPort
  ) {}

  async route(outcome: ReconciliationOutcome, route: ReconciliationReviewRoute, signal: AbortSignal, deadline: number): Promise<void> {
    if (route === 'none') return;
    await this.transactions.write(options(outcome, signal, deadline), async (context) => {
      const database = this.access.database(context);
      const selected = await database.query<ReviewState>(`select state,version,approval_instance_id from finance.reconciliation where id=$1 and scope_id=$2 for update`, [outcome.id, outcome.scopeId]);
      const current = selected.rows[0];
      if (!current || current.state !== 'difference' || Number(current.version) !== outcome.version) throw new DomainError('VERSION_CONFLICT');
      if (route === 'automatic') {
        const resolved = await database.query(
          `with items as(
            update finance.reconciliationitem set state='resolved',
              resolution=jsonb_build_object('kind','threshold','thresholdMinor',$3::bigint,'differenceMinor',difference_minor),
              resolved_by='system:reconciliation',approved_by='system:threshold',resolved_at=clock_timestamp(),approved_at=clock_timestamp(),version=version+1
            where reconciliation_id=$1 and scope_id=$2 and state='difference' and abs(difference_minor)<=$3 returning id
          ) update finance.reconciliation set state='resolved',review_route='automatic',
            evidence=evidence||jsonb_build_object('review',jsonb_build_object('route','automatic','thresholdMinor',$3::bigint,'resolvedItems',(select count(*) from items))),
            updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state='difference' and version=$4
              and not exists(select 1 from finance.reconciliationitem where reconciliation_id=$1 and state in('difference','resolutionpending')) returning id`,
          [outcome.id, outcome.scopeId, outcome.thresholdMinor, outcome.version]
        );
        if (!resolved.rows[0]) throw new DomainError('VERSION_CONFLICT');
        return;
      }
      if (current.approval_instance_id !== null) return;
      const evidenceHash = digest(outcome);
      const receipt = await this.approvals.request(context, {
        scopeId: outcome.scopeId,
        requesterId: outcome.makerId,
        subject: {
          kind: 'reconciliation',
          id: outcome.id,
          version: outcome.version,
          snapshot: {
            statementHash: outcome.statementHash,
            externalMinor: outcome.externalMinor,
            internalMinor: outcome.internalMinor,
            differenceMinor: outcome.differenceMinor,
            differenceCount: outcome.differenceCount,
            maximumDifferenceMinor: outcome.maximumDifferenceMinor,
            thresholdMinor: outcome.thresholdMinor,
          },
        },
        action: 'finance.reconciliation.review',
        evidenceHash,
        amountMinor: Math.abs(outcome.differenceMinor),
        currency: 'CNY',
        constraints: { statementHash: outcome.statementHash, maximumDifferenceMinor: outcome.maximumDifferenceMinor, thresholdMinor: outcome.thresholdMinor },
        expiresAt: null,
      });
      const changed = await database.query(
        `update finance.reconciliation set approval_instance_id=$3,review_route='approval',
          evidence=evidence||jsonb_build_object('review',jsonb_build_object('route','approval','thresholdMinor',$4::bigint,'approvalInstanceId',$3::text,'evidenceHash',$5::text)),
          updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state='difference' and version=$6 and approval_instance_id is null returning id`,
        [outcome.id, outcome.scopeId, receipt.instanceId, outcome.thresholdMinor, evidenceHash, outcome.version]
      );
      if (!changed.rows[0]) throw new DomainError('VERSION_CONFLICT');
    });
  }
}

function options(outcome: ReconciliationOutcome, signal: AbortSignal, deadline: number) {
  return Object.freeze({
    tenant: outcome.scopeId,
    membership: outcome.makerId,
    scope: outcome.scopeId,
    actor: 'system:reconciliation',
    trace: outcome.id,
    operation: 'job.finance.reconciliation.review',
    workload: 'jobs' as const,
    signal,
    deadline,
  });
}

function digest(outcome: ReconciliationOutcome): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: outcome.id,
        scopeId: outcome.scopeId,
        statementHash: outcome.statementHash,
        version: outcome.version,
        externalMinor: outcome.externalMinor,
        internalMinor: outcome.internalMinor,
        differenceMinor: outcome.differenceMinor,
        differenceCount: outcome.differenceCount,
        maximumDifferenceMinor: outcome.maximumDifferenceMinor,
        thresholdMinor: outcome.thresholdMinor,
      })
    )
    .digest('hex');
}
