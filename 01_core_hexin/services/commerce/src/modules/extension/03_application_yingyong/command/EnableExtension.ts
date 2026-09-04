import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { HealthRecord } from '../../02_domain_yewu/model/HealthRecord';
import type { ExtensionCandidate, ExtensionLoader, ExtensionRepositoryFactory } from '../../01_public_gongkai/ExtensionLoader';
import type { AccessContext } from '../../../../foundation/security/AccessContext';

export class EnableExtension {
  constructor(private readonly repositories:ExtensionRepositoryFactory,private readonly loader:ExtensionLoader) {}

  prepare(id:string,access:AccessContext):Promise<ExtensionCandidate> { return this.loader.stage(id,{ tenant:access.scope.tenant??'',
    membership:access.membership.id,scope:access.scope.id,actor:access.actor.id,trace:access.trace,workload:'query' }); }

  async test(database:OperationDatabase,id:string,scope:string,actor:string,trace:string):Promise<void> {
    const repository=this.repositories(database); const current=await repository.lock(id,scope);
    if (!current) throw new Error('RESOURCE_NOT_FOUND');
    if (current.state==='disabled' || current.state==='degraded') await repository.transition(current,'testing',actor,{ reason:'health test',trace });
    else if (current.state!=='testing') throw new Error(`EXTENSION_STATE_INVALID:${current.state}:testing`);
    await repository.enqueueHealth(id,scope);
  }

  async enable(database:OperationDatabase,candidate:ExtensionCandidate,actor:string,trace:string):Promise<string|null> {
    if (candidate.health.state!=='healthy') throw new Error('EXTENSION_HEALTH_REQUIRED');
    const repository=this.repositories(database); const activation=await repository.activation(candidate.installation,candidate.scope,candidate.provider);
    const current=activation.candidate;
    if (current.version!==candidate.version || !['testing','degraded'].includes(current.state)) throw new Error('EXTENSION_CANDIDATE_STALE');
    await repository.health(new HealthRecord(current.id,current.version,candidate.health.state,candidate.health.checkedAt,candidate.latency));
    if (activation.active) await repository.transition(activation.active,'disabled',actor,
      { reason:'atomic replacement',replacement:current.id,trace });
    await repository.transition(current,'enabled',actor,{ reason:'healthy candidate activated',health:candidate.health,latency:candidate.latency,trace });
    await repository.enqueueHealth(current.id,current.scope,60);
    return activation.active?.id??null;
  }

  activate(candidate:ExtensionCandidate):Promise<void> { return this.loader.activate(candidate); }
  discard(candidate:ExtensionCandidate):Promise<void> { return this.loader.discard(candidate); }
}
