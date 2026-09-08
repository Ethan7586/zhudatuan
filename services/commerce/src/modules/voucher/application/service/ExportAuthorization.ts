import type { OperationId } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import { authorizationEvidence } from '../../../../platform/security/AuthorizationEvidence';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { VoucherCall } from '../port/VoucherCall';
import type { RuntimeExportWork } from '../../../runtime/public';

export const exportOperations: Readonly<Record<string, OperationId>> = Object.freeze({
  credential: 'voucher.credentialexports.create',
  issueorder: 'voucher.issueorderexports.create',
  action: 'voucher.actionexports.create',
  search: 'voucher.searchexports.create',
});

export function exportAuthorization(call: VoucherCall<OperationId>, reason: string) {
  const access = requireSession(call.context.security);
  if (access.actor.id !== call.actor || access.scope.id !== call.scope || !Object.values(exportOperations).includes(call.context.operation)) throw new DomainError('AUTHORIZATION_DENIED');
  return Object.freeze({ ...authorizationEvidence(access, call.context.operation, call.now), reason });
}

export function assertExportWork(work: RuntimeExportWork): void {
  if (
    !Object.hasOwn(exportOperations, work.kind) ||
    work.authorization.operation !== exportOperations[work.kind] ||
    work.authorization.scope !== work.scope ||
    typeof work.authorization.actor !== 'string' ||
    !work.authorization.actor.trim() ||
    work.authorization.actor.length > 255 ||
    typeof work.authorization.reason !== 'string' ||
    work.authorization.reason.trim().length < 2
  )
    throw new DomainError('AUTHORIZATION_DENIED');
}
