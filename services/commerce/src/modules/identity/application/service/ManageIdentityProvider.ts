import { type IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { identityCallback, type IdentityProviderType } from '@shop/config/server';
import type { KmsClient } from '../../../../foundation/application/KmsPort';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import type { ProviderRepository } from '../port/ProviderRepository';
export class ManageIdentityProvider {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly kms: KmsClient
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const id = request.input.path.providerid;
      if (!/^[0-9a-f-]{36}$/.test(id ?? '') || request.input.expectedVersion === undefined || !access.scope.tenant) throw new DomainError('VALIDATION_FAILED');
      const body = bodyRecord(request.input);
      const type = textField(body, 'type', 16) as IdentityProviderType;
      if (!['wechat', 'wecomcorp', 'wecomsuite', 'oidc'].includes(type)) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
      const issuer = body.issuer === null ? null : textField(body, 'issuer', 1024);
      const scopes = array(body.scopes, 32);
      const status = textField(body, 'status', 16) as 'draft' | 'enabled' | 'disabled' | 'revoked';
      if (!['draft', 'enabled', 'disabled', 'revoked'].includes(status)) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
      const now = new Date().toISOString();
      const saved = await this.providers.save(
        requireWriteTransaction(database),
        {
          id: id!,
          type,
          tenantid: access.scope.tenant,
          issuer,
          clientid: textField(body, 'clientid', 255),
          secretref: textField(body, 'secretref', 128),
          status,
          redirecturi: identityCallback(id!),
          scopes,
          version: request.input.expectedVersion,
          createdat: now,
          updatedat: now,
        },
        request.input.expectedVersion,
        this.kms
      );
      return { status: 200, body: saved, headers: { etag: `"${saved.version}"` } };
    };
  }
}
function array(value: unknown, maximum: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || !item || item.length > 128) || new Set(value).size !== value.length) throw new DomainError('VALIDATION_FAILED');
  return Object.freeze(value as string[]);
}
