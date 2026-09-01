import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import type { InvitationRepository } from '../port/InvitationRepository';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class ReadInvitations {
  constructor(private readonly repository: InvitationRepository) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const access = requireAccess(request);
      const cursor = typeof request.input.query.cursor === 'string' ? request.input.query.cursor : null;
      const requested = Number(request.input.query.limit ?? 50);
      const limit = Number.isSafeInteger(requested) ? Math.min(100, Math.max(1, requested)) : 50;
      const target = enumQuery(request.input.query.target, ['console', 'storefront'] as const);
      const kind = enumQuery(request.input.query.kind, ['signin', 'enrollment', 'campaign'] as const);
      const status = enumQuery(request.input.query.status, ['draft', 'active', 'exhausted', 'revoked', 'expired'] as const);
      const items = await this.repository.read(database, { scope: access.scope.id, target, kind, status, cursor, limit });
      const nextCursor = items.length === limit ? String(items.at(-1)?.id ?? '') : undefined;
      return { status: 200, body: { items, count: items.length, ...(nextCursor === undefined ? {} : { nextCursor }) } };
    };
  }
}

function enumQuery<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new DomainError('VALIDATION_FAILED');
  return value as T;
}
