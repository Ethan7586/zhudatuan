import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { VersionRepository } from '../port/VersionRepository';

export class VersionsRestoreHandler implements OperationHandler<'experience.versions.restore', 'write'> {
  readonly operation = 'experience.versions.restore' as const;
  readonly mode = 'write' as const;
  constructor(private readonly versions: VersionRepository) {}
  async execute(input: OperationInputFor<'experience.versions.restore'>, context: WriteHandlerContext<'experience.versions.restore'>): Promise<OperationReply<OperationOutputFor<'experience.versions.restore'>>> {
    const access = requireSession(context.security);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const restored = await this.versions.restore(context.transaction, { version: input.path.versionid, expectedVersion: context.expectedVersion, reason: textField(bodyRecord(input), 'reason', 500), actor: access.actor.id });
    return { status: 201, body: restored as unknown as OperationOutputFor<'experience.versions.restore'> };
  }
}
