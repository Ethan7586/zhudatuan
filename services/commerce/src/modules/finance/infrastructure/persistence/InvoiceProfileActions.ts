import { rowResult } from '../../../../adapter/database/DatabaseResult';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { KmsClient } from '../../../../foundation/application/KmsPort';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { financeLifecycle, type FinanceEntries } from './FinanceOperation';
import { PgInvoiceProfileRepository } from './PgInvoiceProfileRepository';

export function invoiceProfileActions(kms: KmsClient): FinanceEntries<'profilesManage'> {
  return {
    profilesManage: financeLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request.input);
        const [title, taxid, address] = await Promise.all([
          kms.encrypt('pii', 'pii/invoice', textField(body, 'title'), { owner: access.scope.id, field: 'title' }),
          kms.encrypt('pii', 'pii/invoice', textField(body, 'taxid'), { owner: access.scope.id, field: 'taxid' }),
          body.address ? kms.encrypt('pii', 'pii/invoice', String(body.address), { owner: access.scope.id, field: 'address' }) : Promise.resolve(null),
        ]);
        return { access, body, title, taxid, address };
      },
      execute: async (request, database, { access, body, title, taxid, address }) => {
        const result = await new PgInvoiceProfileRepository(database).manage({
          id: request.input.path.profileid!,
          ownerId: access.scope.id,
          title,
          taxid,
          address,
          titleMasked: maskTitle(textField(body, 'title')),
          taxidMasked: maskTaxid(textField(body, 'taxid')),
          expectedVersion: request.input.expectedVersion ?? null,
        });
        if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
        return rowResult(result);
      },
    }),
  };
}

function maskTitle(value: string): string {
  return value.length < 3 ? `${value.slice(0, 1)}*` : `${value.slice(0, 2)}${'*'.repeat(Math.min(6, value.length - 2))}`;
}

function maskTaxid(value: string): string {
  return value.length < 8 ? '****' : `${value.slice(0, 4)}********${value.slice(-4)}`;
}
