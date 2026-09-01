import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VersionRepository } from '../port/VersionRepository';

export class VersionsValidateHandler implements OperationHandler<'experience.versions.validate', 'write'> {
  readonly operation = 'experience.versions.validate' as const;
  readonly mode = 'write' as const;
  constructor(private readonly versions: VersionRepository) {}
  async execute(input: OperationInputFor<'experience.versions.validate'>, context: WriteHandlerContext<'experience.versions.validate'>): Promise<OperationReply<OperationOutputFor<'experience.versions.validate'>>> {
    context.signal.throwIfAborted();
    const validated = await this.versions.validate(context.transaction, input.path.versionid);
    return { status: 200, body: validated as unknown as OperationOutputFor<'experience.versions.validate'> };
  }
}
