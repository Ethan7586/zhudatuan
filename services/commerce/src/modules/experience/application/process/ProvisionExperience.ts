import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { MallProvisionPort } from '../../../organization/public';
import type { ExperienceProvisionRepository } from '../port/ExperienceProvisionRepository';

export interface ExperienceProvisionRequest {
  readonly event: string;
  readonly mall: string;
  readonly mallVersion: number;
  readonly actor: string;
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ProvisionExperience {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly malls: MallProvisionPort,
    private readonly repository: ExperienceProvisionRepository
  ) {}

  async execute(request: ExperienceProvisionRequest): Promise<void> {
    const snapshot = await this.transactions.read(this.options(request, 'load'), (context) => this.malls.mall(context, request.mall, request.mallVersion));
    if (!snapshot || snapshot.id !== request.mall || snapshot.version < request.mallVersion) throw new Error('EXPERIENCE_MALL_PROVISION_SNAPSHOT_MISSING');
    await this.transactions.write(this.options(request, 'provision'), (context) => this.repository.provision(context, { event: request.event, mall: snapshot, actor: request.actor }));
  }

  private options(request: ExperienceProvisionRequest, action: string): TransactionOptions {
    return { tenant: request.scope, membership: '', scope: request.scope, actor: 'job:experienceprovision', trace: request.trace, operation: `job.experience.${action}`, workload: 'jobs', signal: request.signal, deadline: request.deadline };
  }
}
