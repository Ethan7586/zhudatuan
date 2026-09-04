import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationHierarchyPort } from '../../../organization/public/HierarchyPort';
import type { PartnerRepository } from '../port/PartnerRepository';
const STATES = new Set(['pending', 'active', 'suspended', 'terminated']);
interface PreparedStore {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly region: string;
  readonly mall: string | null;
  readonly radius: number | null;
  readonly envelope: Readonly<{ ciphertext: string; fingerprint: string; keyVersion: string }> | null | undefined;
}
export class StoresManageHandler implements DurableOperationHandler<'organization.stores.manage', PreparedStore, OperationOutputFor<'organization.stores.manage'>, 'write'> {
  readonly operation = 'organization.stores.manage' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly partners: PartnerRepository,
    private readonly organizations: OrganizationHierarchyPort,
    private readonly kms: KmsClient
  ) {}
  async prepare(input: OperationInputFor<'organization.stores.manage'>, context: PrepareContext<'organization.stores.manage'>): Promise<PreparedStore> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const id = input.path.storeid;
    const status = textField(body, 'status', 16);
    const region = textField(body, 'regionCode', 32);
    if (!STATES.has(status) || !/^[A-Za-z0-9.-]{2,32}$/.test(region)) throw new DomainError('VALIDATION_FAILED');
    const mall = body.mall == null ? null : textField(body, 'mall');
    const radius = body.serviceRadiusMeters == null ? null : integerField(body, 'serviceRadiusMeters', 1);
    if (radius !== null && radius > 1_000_000) throw new DomainError('VALIDATION_FAILED');
    const address = body.address === undefined ? undefined : body.address === null ? null : textField(body, 'address', 1000);
    const envelope = address === undefined ? undefined : address === null ? null : await this.kms.encrypt('pii', 'partner/store/address', address, { store: id, scope: access.scope.id });
    return Object.freeze({ id, name: textField(body, 'name', 160), status, region, mall, radius, envelope });
  }
  async commit(_input: OperationInputFor<'organization.stores.manage'>, prepared: PreparedStore, context: CommitContext<'organization.stores.manage'>) {
    const access = requireSession(context.security);
    const scopes = await this.organizations.descendants(context.transaction, organizationScope(access.scope));
    const current = await this.partners.storeScope(context.transaction, prepared.id, scopes);
    if (prepared.mall !== null) {
      const mall = await this.organizations.node(context.transaction, prepared.mall, true);
      if (mall.kind !== 'mall' || !scopes.includes(mall.id)) throw new DomainError('RESOURCE_NOT_FOUND');
    }
    const row = await this.partners.saveStore(context.transaction, {
      id: prepared.id,
      scope: prepared.mall ?? current ?? access.scope.id,
      scopes,
      name: prepared.name,
      status: prepared.status,
      mall: prepared.mall,
      region: prepared.region,
      radius: prepared.radius,
      addressChanged: prepared.envelope !== undefined,
      ciphertext: prepared.envelope === undefined ? undefined : (prepared.envelope?.ciphertext ?? null),
      token: prepared.envelope === undefined ? undefined : (prepared.envelope?.fingerprint ?? null),
      keyVersion: prepared.envelope === undefined ? undefined : (prepared.envelope?.keyVersion ?? null),
      expectedVersion: context.expectedVersion ?? null,
    });
    if (!row) throw new DomainError('VERSION_CONFLICT');
    const body = row as OperationOutputFor<'organization.stores.manage'>;
    const response = { status: 200, body, headers: { etag: `"${body.version}"` } };
    return Object.freeze({ checkpoint: response.body, response });
  }
  finalize(
    _input: OperationInputFor<'organization.stores.manage'>,
    checkpoint: OperationOutputFor<'organization.stores.manage'>,
    _context: FinalizeContext<'organization.stores.manage'>
  ): Promise<OperationReply<OperationOutputFor<'organization.stores.manage'>>> {
    return Promise.resolve({ status: 200, body: checkpoint, headers: { etag: `"${checkpoint.version}"` } });
  }
}
