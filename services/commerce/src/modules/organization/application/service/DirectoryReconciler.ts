import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';
import { LifecyclePolicy } from '../../domain/policy/LifecyclePolicy';
import type { DirectoryRepository, DirectoryCounts, StagedSubject } from '../port/DirectoryRepository';
import type { MembershipLifecycle } from './MembershipLifecycle';

export class DirectoryReconciler {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly lifecycle: MembershipLifecycle,
    private readonly policy = new LifecyclePolicy()
  ) {}
  async reconcile(context: WriteTransactionContext, connection: DirectoryConnection, subjects: readonly StagedSubject[], trace: string): Promise<DirectoryCounts> {
    const current = await this.repository.current(
      context,
      connection.id,
      subjects.map((item) => item.hash)
    );
    let applied = 0,
      conflicts = 0,
      ignored = 0;
    for (const source of subjects) {
      const existing = current.get(source.hash.toString('hex')) ?? null;
      const kind = this.policy.decide(existing, { status: source.status, sourceversion: source.sourceversion, explicitdeparture: source.explicitdeparture });
      if (kind === 'noop') {
        ignored += 1;
        continue;
      }
      const subject = { ...source, membership: existing?.membership ?? source.membership };
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
      if (kind === 'conflict') conflicts += 1;
      else applied += 1;
    }
    return Object.freeze({ read: subjects.length, applied, conflicts, ignored });
  }
}
