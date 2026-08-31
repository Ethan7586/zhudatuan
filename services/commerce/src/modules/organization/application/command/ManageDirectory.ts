import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { DirectoryRepository } from '../port/DirectoryRepository';

export class ManageDirectory {
  constructor(private readonly repository: DirectoryRepository) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const id = request.input.path.directoryid;
      if (!uuid(id) || !access.scope.tenant || request.input.expectedVersion === undefined) throw new DomainError('VALIDATION_FAILED');
      const body = bodyRecord(request);
      const providerid = textField(body, 'providerid', 36);
      if (!uuid(providerid)) throw new DomainError('VALIDATION_FAILED');
      const providertype = textField(body, 'providertype', 16) as 'wecomcorp' | 'wecomsuite';
      if (!['wecomcorp', 'wecomsuite'].includes(providertype)) throw new DomainError('VALIDATION_FAILED');
      const status = textField(body, 'status', 16) as 'draft' | 'enabled' | 'paused' | 'disabled' | 'revoked';
      if (!['draft', 'enabled', 'paused', 'disabled', 'revoked'].includes(status)) throw new Error('DIRECTORY_CONFIGURATION_INVALID');
      const secretref = textField(body, 'secretref', 128);
      const saved = await this.repository.save(
        database,
        { id: id!, tenantid: access.scope.tenant, organizationid: textField(body, 'organizationid', 128), providerid, providertype, secretref, cursor: null, successfulversion: 0, status, version: request.input.expectedVersion },
        request.input.expectedVersion
      );
      return {
        status: 200,
        body: {
          id: saved.id,
          tenantid: saved.tenantid,
          organizationid: saved.organizationid,
          providerid: saved.providerid,
          providertype: saved.providertype,
          status: saved.status,
          successfulversion: saved.successfulversion,
          version: saved.version,
        },
        headers: { etag: `"${saved.version}"` },
      };
    };
  }
}
function uuid(value: string | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
