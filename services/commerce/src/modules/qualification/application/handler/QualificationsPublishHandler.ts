import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { JobScheduler } from '../../../../pipeline/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { mapParallel } from '@shop/kernel';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { qualificationChangedEvent } from '../../domain/event/QualificationEvents';
import { Evidence } from '../../domain/model/Evidence';
import { QualificationCase, type QualificationCaseSnapshot } from '../../domain/model/QualificationCase';
import type { QualificationCaseRecord, QualificationCaseRepository } from '../port/QualificationCaseRepository';
import { dateInput, evidenceInput, targetInput, targetList } from '../service/QualificationInput';

interface PreparedQualification {
  readonly candidate: QualificationCaseSnapshot;
  readonly expectedVersion: number;
  readonly actor: string;
  readonly scope: string;
}

type Reply = OperationReply<OperationOutputFor<'qualification.qualifications.publish'>>;

export class QualificationsPublishHandler
  implements DurableOperationHandler<'qualification.qualifications.publish', PreparedQualification, OperationOutputFor<'qualification.qualifications.publish'>, 'write', QualificationCaseSnapshot | null>
{
  readonly operation = 'qualification.qualifications.publish' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly cases: QualificationCaseRepository,
    private readonly objects: ObjectStore,
    private readonly jobs: JobScheduler
  ) {}

  load(input: OperationInputFor<'qualification.qualifications.publish'>, context: HandlerContext<'qualification.qualifications.publish'>) {
    const access = requireSession(context.security);
    return this.cases.find(context.transaction, access.scope.id, input.path.qualificationid);
  }

  async prepare(input: OperationInputFor<'qualification.qualifications.publish'>, context: PrepareContext<'qualification.qualifications.publish'>, loaded: QualificationCaseSnapshot | null): Promise<PreparedQualification> {
    const access = requireSession(context.security);
    const expectedVersion = context.expectedVersion;
    if (expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    if ((loaded?.version ?? 0) !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
    if (loaded && loaded.state !== 'verified') throw new DomainError('VALIDATION_FAILED', { field: 'state', reason: 'QUALIFICATION_NOT_VERIFIED' });
    const now = new Date().toISOString();
    const body = bodyRecord(input);
    const source = loaded?.evidence ?? evidenceInput(body.evidence);
    const verified = await mapParallel(source, 4, async (item) => {
      const metadata = await this.objects.inspect(item.reference);
      return Evidence.verified({ id: item.id, kind: item.kind, reference: item.reference, sha256: item.sha256, actor: access.actor.id, now }, metadata).snapshot();
    });
    const candidate = loaded
      ? QualificationCase.restore(loaded).snapshot()
      : QualificationCase.verified({
          id: input.path.qualificationid,
          scope: access.scope.id,
          title: textField(body, 'title'),
          subject: targetInput(body.subject, 'subject'),
          applicability: targetList(body.applicability),
          effectiveAt: dateInput(body.effectiveAt, 'effectiveAt', now),
          expiresAt: dateInput(body.expiresAt, 'expiresAt'),
          evidence: verified,
          actor: access.actor.id,
          now,
        }).snapshot();
    return Object.freeze({ candidate, expectedVersion, actor: access.actor.id, scope: access.scope.id });
  }

  transactionScope(_input: OperationInputFor<'qualification.qualifications.publish'>, prepared: PreparedQualification): string {
    return prepared.scope;
  }

  async commit(_input: OperationInputFor<'qualification.qualifications.publish'>, prepared: PreparedQualification, context: CommitContext<'qualification.qualifications.publish'>) {
    const locked = await this.cases.lock(context.transaction, prepared.scope, prepared.candidate.id);
    if ((locked?.version ?? 0) !== prepared.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const source = locked ? QualificationCase.restore(locked) : QualificationCase.restore(prepared.candidate);
    const published = source.publish(new Date().toISOString()).snapshot();
    const saved = await this.cases.save(context.transaction, published, prepared.expectedVersion);
    if (!saved) throw new DomainError('VERSION_CONFLICT');
    await this.jobs.schedule(context.transaction, {
      id: `job:qualificationexpiry:${published.id}:${published.version}`,
      kind: 'qualificationexpiry',
      owner: 'qualification',
      scope: published.scope,
      payload: { qualification: published.id, version: published.version, traceId: context.traceId },
      priority: 10,
      availableAt: published.expiresAt,
    });
    const response = reply(saved);
    return Object.freeze({
      checkpoint: response.body,
      response,
      events: [qualificationChangedEvent(published, { actor: prepared.actor, trace: context.traceId })],
    });
  }

  finalize(_input: OperationInputFor<'qualification.qualifications.publish'>, checkpoint: OperationOutputFor<'qualification.qualifications.publish'>): Promise<Reply> {
    return Promise.resolve({ status: 200, body: checkpoint });
  }
}

function reply(record: QualificationCaseRecord): Reply {
  return { status: 200, body: record as OperationOutputFor<'qualification.qualifications.publish'> };
}
