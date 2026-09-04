import { parseExperience } from '@shop/contract';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { VersionRepository } from '../port/VersionRepository';

export class VersionsSaveHandler implements OperationHandler<'experience.versions.save', 'write'> {
  readonly operation = 'experience.versions.save' as const;
  readonly mode = 'write' as const;
  constructor(private readonly versions: VersionRepository) {}
  async execute(input: OperationInputFor<'experience.versions.save'>, context: WriteHandlerContext<'experience.versions.save'>): Promise<OperationReply<OperationOutputFor<'experience.versions.save'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    if (!body.configuration || typeof body.configuration !== 'object' || Array.isArray(body.configuration)) throw new DomainError('VALIDATION_FAILED', { field: 'configuration' });
    if (String(body.schemaVersion) !== '2') throw new Error('EXPERIENCE_VERSION_INVALID');
    const document = parseExperience(body.configuration);
    if (document.application !== input.path.applicationid) throw new Error('EXPERIENCE_APPLICATION_INVALID');
    const saved = await this.versions.save(context.transaction, { application: input.path.applicationid, expectedVersion: context.expectedVersion, document, reason: textField(body, 'reason', 500), actor: access.actor.id });
    return { status: 201, body: saved as unknown as OperationOutputFor<'experience.versions.save'> };
  }
}
