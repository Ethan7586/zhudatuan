import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ExperienceValidator } from '../service/ExperienceValidator';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';

export class VersionsValidateHandler implements OperationHandler<'experience.versions.validate', 'write'> {
  readonly operation = 'experience.versions.validate' as const;
  readonly mode = 'write' as const;
  constructor(private readonly validator: ExperienceValidator) {}
  async execute(input: OperationInputFor<'experience.versions.validate'>, context: WriteHandlerContext<'experience.versions.validate'>): Promise<OperationReply<OperationOutputFor<'experience.versions.validate'>>> {
    requireSession(context.security);
    context.signal.throwIfAborted();
    const validation = await this.validator.validate(context.transaction, input.path.versionid);
    return {
      status: 200,
      body: {
        id: input.path.versionid,
        application_id: validation.candidate.application,
        validation_state: validation.issues.length === 0 ? 'valid' : 'invalid',
        issues: validation.issues,
      } as OperationOutputFor<'experience.versions.validate'>,
    };
  }
}
