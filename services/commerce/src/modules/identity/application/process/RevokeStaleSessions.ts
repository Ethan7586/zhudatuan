import type { Inbox } from '../../../../foundation/messaging/Inbox';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { SessionRevocationRepository } from '../port/SessionRevocationRepository';

export interface SessionRevocationExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class RevokeStaleSessions {
  constructor(private readonly transactions: TransactionManager, private readonly inbox: Inbox, private readonly sessions: SessionRevocationRepository) {}

  async execute(event: string, payload: Readonly<Record<string, unknown>>, execution: SessionRevocationExecution): Promise<void> {
    const membership = requiredText(payload.membership, 'ACCESS_VERSION_MEMBERSHIP_REQUIRED');
    const version = requiredVersion(payload.version);
    const reason = requiredText(payload.reason, 'ACCESS_VERSION_REASON_REQUIRED');
    await this.transactions.write(
      {
        tenant: execution.scope,
        membership: '',
        scope: execution.scope,
        actor: 'job:sessionrevocation',
        trace: execution.trace,
        operation: 'job.identity.sessionrevocation',
        workload: 'jobs',
        signal: execution.signal,
        deadline: execution.deadline,
      },
      async (context) => {
        await this.sessions.revokeStale(context, { membership, version, reason, trace: execution.trace });
        await this.inbox.complete(context, 'internal', 'job:sessionrevocation', event);
      }
    );
  }
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

function requiredVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('ACCESS_VERSION_INVALID');
  return value;
}
