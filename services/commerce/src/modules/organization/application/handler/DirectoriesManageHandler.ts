import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationRepository } from '../port/OrganizationRepository';
export class DirectoriesManageHandler implements OperationHandler<'organization.directories.manage', 'write'> {
  readonly operation = 'organization.directories.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly organizations: OrganizationRepository) {}
  async execute(input: OperationInputFor<'organization.directories.manage'>, context: WriteHandlerContext<'organization.directories.manage'>): Promise<OperationReply<OperationOutputFor<'organization.directories.manage'>>> {
    const access = requireSession(context.security);
    const id = input.path.directoryid;
    const expected = context.expectedVersion;
    if (!uuid(id) || !access.scope.tenant || expected === undefined) throw new DomainError('VALIDATION_FAILED');
    const body = bodyRecord(input);
    const providerid = textField(body, 'providerid', 36);
    if (!uuid(providerid)) throw new DomainError('VALIDATION_FAILED');
    const providertype = providerType(textField(body, 'providertype', 16));
    const status = directoryStatus(textField(body, 'status', 16));
    const saved = await this.organizations.saveDirectory(
      context.transaction,
      { id, tenantid: access.scope.tenant, organizationid: textField(body, 'organizationid', 128), providerid, providertype, secretref: textField(body, 'secretref', 128), cursor: null, successfulversion: 0, status, version: expected },
      expected
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
  }
}
function uuid(value: string | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function providerType(value: string): 'wecomcorp' | 'wecomsuite' {
  if (value !== 'wecomcorp' && value !== 'wecomsuite') throw new DomainError('VALIDATION_FAILED');
  return value;
}
function directoryStatus(value: string): 'draft' | 'enabled' | 'paused' | 'disabled' | 'revoked' {
  if (!['draft', 'enabled', 'paused', 'disabled', 'revoked'].includes(value)) throw new Error('DIRECTORY_CONFIGURATION_INVALID');
  return value as 'draft' | 'enabled' | 'paused' | 'disabled' | 'revoked';
}
