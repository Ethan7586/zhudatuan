import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';
import type { EnrollmentDraft, EnrollmentInvitationScope } from '../service/EnrollmentService';

export class EnrollmentsCompleteHandler implements DurableOperationHandler<'identity.enrollments.complete', PreparedIdentityLifecycle<EnrollmentDraft>, IdentityLifecycleCheckpoint<EnrollmentDraft>, 'write', EnrollmentInvitationScope> {
  readonly operation = 'identity.enrollments.complete' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<EnrollmentDraft, EnrollmentInvitationScope>) {}

  load(input: OperationInputFor<'identity.enrollments.complete'>, context: HandlerContext<'identity.enrollments.complete'>): Promise<EnrollmentInvitationScope> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('IDENTITY_ENROLLMENT_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.enrollments.complete'>, context: PrepareContext<'identity.enrollments.complete'>, loaded: EnrollmentInvitationScope): Promise<PreparedIdentityLifecycle<EnrollmentDraft>> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('IDENTITY_ENROLLMENT_PREPARE_REQUIRED');
    const preparation = await this.lifecycle.prepare(request, loaded);
    return Object.freeze({ request, preparation });
  }

  transactionScope(_input: OperationInputFor<'identity.enrollments.complete'>, prepared: PreparedIdentityLifecycle<EnrollmentDraft>): string {
    return prepared.preparation.scope;
  }

  async commit(_input: OperationInputFor<'identity.enrollments.complete'>, prepared: PreparedIdentityLifecycle<EnrollmentDraft>, context: CommitContext<'identity.enrollments.complete'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.enrollments.complete'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.enrollments.complete'>,
    checkpoint: IdentityLifecycleCheckpoint<EnrollmentDraft>,
    _context: FinalizeContext<'identity.enrollments.complete'>
  ): Promise<OperationReply<OperationOutputFor<'identity.enrollments.complete'>>> {
    const result = this.lifecycle.finalize ? await this.lifecycle.finalize(checkpoint.request, checkpoint.result, checkpoint.preparation) : checkpoint.result;
    return identityReply<'identity.enrollments.complete'>(result);
  }

  discard(prepared: PreparedIdentityLifecycle<EnrollmentDraft>, cause: unknown): Promise<void> {
    return this.lifecycle.discard?.(prepared.request, prepared.preparation, cause) ?? Promise.resolve();
  }
}
