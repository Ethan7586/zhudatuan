import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { InstallationRepository } from '../port/InstallationRepository';

export class InstallationsReadHandler implements OperationHandler<'extension.installations.read', 'read'> {
  readonly operation = 'extension.installations.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly installations: InstallationRepository) {}
  async execute(input: OperationInputFor<'extension.installations.read'>, context: HandlerContext<'extension.installations.read'>): Promise<OperationReply<OperationOutputFor<'extension.installations.read'>>> {
    requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.installations.list(context.transaction, page, page.fetch);
    const result = keysetPage(rows, page, 'installed_at');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'extension.installations.read'> };
  }
}
