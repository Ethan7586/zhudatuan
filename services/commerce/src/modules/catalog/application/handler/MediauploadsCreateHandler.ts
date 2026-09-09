import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { AssetPort } from '../../../runtime/public';

export class MediauploadsCreateHandler implements OperationHandler<'catalog.mediauploads.create', 'write'> {
  readonly operation = 'catalog.mediauploads.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly assets: AssetPort) {}

  async execute(input: OperationInputFor<'catalog.mediauploads.create'>, context: WriteHandlerContext<'catalog.mediauploads.create'>): Promise<OperationReply<OperationOutputFor<'catalog.mediauploads.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const contentType = textField(body, 'contentType', 128);
    if (contentType !== 'image/jpeg' && contentType !== 'image/png') throw new DomainError('VALIDATION_FAILED', { field: 'contentType' });
    try {
      const record = await this.assets.authorize({
        tenant: access.scope.tenant ?? access.organization,
        name: textField(body, 'name', 255),
        contentType,
        size: Number(body.size),
        sha256: textField(body, 'sha256', 64),
      });
      const { upload, ...asset } = record;
      const { reference: _reference, ...authorization } = upload;
      return { status: 201, body: Object.freeze({ ...asset, upload: Object.freeze(authorization) }) };
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      if (cause instanceof Error && cause.message === 'UPLOAD_SESSION_INVALID') throw new DomainError('VALIDATION_FAILED', { field: 'image' });
      throw cause;
    }
  }
}
