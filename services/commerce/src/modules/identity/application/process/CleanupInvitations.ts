import type { Telemetry, TelemetryContext } from '@shop/telemetry';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import { invitationRateBuckets } from '../../domain/policy/InvitationRatePolicy';
import type { CleanupCursor, InvitationCleanupRepository } from '../port/CleanupRepository';

export interface InvitationCleanupRequest {
  readonly scope: string;
  readonly trace: string;
  readonly job: string;
  readonly attempts: number;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class CleanupInvitations {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: InvitationCleanupRepository,
    private readonly telemetry: Telemetry,
    private readonly batch = 200
  ) {
    if (!Number.isInteger(batch) || batch < 1 || batch > 200) throw new Error('INVITATION_CLEANUP_BATCH_INVALID');
  }

  async execute(request: InvitationCleanupRequest): Promise<void> {
    const telemetry: TelemetryContext = {
      requestId: request.job,
      traceId: request.trace,
      module: 'identity',
      job: 'invitationcleanup',
      attempt: request.attempts,
    };
    const options = this.options(request);
    const invitations = await this.expirePages(request, options, (context, cursor) => this.repository.expireInvitations(context, cursor, this.batch, request.trace));
    const claims = await this.expirePages(request, options, (context, cursor) => this.repository.expireClaims(context, cursor, this.batch));
    const preauth = await this.expirePages(request, options, (context, cursor) => this.repository.expirePreauth(context, cursor, this.batch));
    const rates = await this.expireRates(request, options);
    this.telemetry.metrics.count('identity_invitation_stale_total', invitations, telemetry);
    const active = await this.transactions.read(options, (context) => this.repository.activeClaims(context));
    this.telemetry.metrics.count('identity_invitation_claim_active', active, telemetry);
    this.telemetry.metrics.count('identity_invitation_cleanup_total', claims + preauth + rates, {
      ...telemetry,
      result: 'success',
      resourceType: 'claimpreauth',
    });
  }

  private async expirePages(
    request: InvitationCleanupRequest,
    options: TransactionOptions,
    expire: (context: Parameters<InvitationCleanupRepository['expireClaims']>[0], cursor: CleanupCursor | undefined) => Promise<readonly CleanupCursor[]>
  ): Promise<number> {
    let cursor: CleanupCursor | undefined;
    let total = 0;
    do {
      assertRunning(request.signal);
      const rows = await this.transactions.write(options, (context) => expire(context, cursor));
      total += rows.length;
      cursor = rows.at(-1);
      if (rows.length < this.batch) return total;
    } while (true);
  }

  private async expireRates(request: InvitationCleanupRequest, options: TransactionOptions): Promise<number> {
    let total = 0;
    do {
      assertRunning(request.signal);
      const deleted = await this.transactions.write(options, (context) => this.repository.expireRates(context, invitationRateBuckets(), this.batch));
      total += deleted;
      if (deleted < this.batch) return total;
    } while (true);
  }

  private options(request: InvitationCleanupRequest): TransactionOptions {
    return {
      tenant: request.scope,
      membership: '',
      scope: request.scope,
      actor: 'job:invitationcleanup',
      trace: request.trace,
      operation: 'job.identity.invitationcleanup',
      workload: 'jobs',
      signal: request.signal,
      deadline: request.deadline,
    };
  }
}

function assertRunning(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new Error('JOB_ABORTED');
}
