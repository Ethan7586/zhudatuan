import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';
import { LifecyclePolicy } from '../../domain/policy/LifecyclePolicy';
import type { DirectoryRepository, DirectoryCounts, StagedSubject } from '../port/DirectoryRepository';
import type { MembershipLifecycle } from './MembershipLifecycle';
import { DirectoryDiff } from '../../domain/model/DirectoryDiff';

interface PlannedSubject {
  readonly subject: StagedSubject;
  readonly kind: import('../port/DirectoryRepository').DirectoryApplyKind | 'noop';
}

export class DirectoryReconciler {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly lifecycle: MembershipLifecycle,
    private readonly policy = new LifecyclePolicy()
  ) {}
  async reconcile(context: WriteTransactionContext, connection: DirectoryConnection, subjects: readonly StagedSubject[], trace: string): Promise<DirectoryCounts> {
    const plan = await this.plan(context, connection, subjects);
    for (const { subject, kind } of plan) {
      if (kind === 'noop') continue;
      if (subject.type === 'user' && subject.membership !== null && ['freeze', 'restore', 'update'].includes(kind))
        await this.lifecycle.apply(context, {
          membership: subject.membership,
          organization: connection.organizationid,
          department: kind === 'freeze' ? null : subject.organization,
          action: kind as 'freeze' | 'restore' | 'update',
          explicitdeparture: subject.explicitdeparture,
          trace,
        });
      await this.repository.apply(context, connection, subject, kind);
    }
    return new DirectoryDiff(plan.map(({ kind }) => kind));
  }

  async preview(context: WriteTransactionContext, connection: DirectoryConnection, subjects: readonly StagedSubject[]): Promise<DirectoryCounts> {
    const plan = await this.plan(context, connection, subjects);
    return new DirectoryDiff(plan.map(({ kind }) => kind));
  }

  private async plan(context: WriteTransactionContext, connection: DirectoryConnection, subjects: readonly StagedSubject[]): Promise<readonly PlannedSubject[]> {
    const current = await this.repository.current(
      context,
      connection.id,
      subjects.map((item) => item.hash)
    );
    return Object.freeze(subjects.map((source) => {
      const existing = current.get(source.hash.toString('hex')) ?? null;
      const kind = this.policy.decide(existing, { status: source.status, sourceversion: source.sourceversion, explicitdeparture: source.explicitdeparture });
      const subject = { ...source, membership: existing?.membership ?? source.membership };
      return Object.freeze({ subject: Object.freeze(subject), kind });
    }));
  }
}
