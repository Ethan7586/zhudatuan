import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { limit } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ClientErrorRepository } from '../port/ClientErrorRepository';

export class ClientErrorsReadHandler implements OperationHandler<'observability.clienterrors.read', 'read'> {
  readonly operation = 'observability.clienterrors.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly errors: ClientErrorRepository) {}
  async execute(input: OperationInputFor<'observability.clienterrors.read'>, context: HandlerContext<'observability.clienterrors.read'>): Promise<OperationReply<OperationOutputFor<'observability.clienterrors.read'>>> {
    const items = this.errors.list(requireSession(context.security).scope, limit(input, 200));
    const output = items.map((item) => ({ ...item, surface: surface(item.surface), scope: { ...item.scope, path: item.scope.path.map((entry) => ({ ...entry })) } }));
    return { status: 200, body: { items: output, count: output.length } };
  }
}

function surface(value: string): 'console' | 'storefront' | 'auth' {
  if (value !== 'console' && value !== 'storefront' && value !== 'auth') throw new Error('CLIENT_ERROR_SURFACE_INVALID');
  return value;
}
