import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { UploadPort } from '../port/UploadPort';

export class UploadsCreateHandler implements OperationHandler<'runtime.uploads.create', 'write'> {
  readonly operation = 'runtime.uploads.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly uploads: UploadPort) {}

  async execute(input: OperationInputFor<'runtime.uploads.create'>, context: WriteHandlerContext<'runtime.uploads.create'>): Promise<OperationReply<OperationOutputFor<'runtime.uploads.create'>>> {
    const access = requireSession(context.security);
    try {
      const body = bodyRecord(input);
      const contentType = textField(body, 'contentType', 128);
      if (contentType !== 'text/csv' && contentType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new DomainError('VALIDATION_FAILED', { field: 'contentType' });
      }
      const session = await this.uploads.authorize({
        tenant: access.scope.tenant ?? access.organization,
        category: 'import',
        name: textField(body, 'name', 255),
        contentType,
        size: Number(body.size),
        sha256: textField(body, 'sha256', 64),
        retentionDays: RUNTIME_LIMITS.upload.retentionDays.import,
      });
      return { status: 201, body: session };
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      if (cause instanceof Error && cause.message === 'UPLOAD_SESSION_INVALID') throw new DomainError('VALIDATION_FAILED', { field: 'file' });
      throw cause;
    }
  }
}
