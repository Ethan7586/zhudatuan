import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage, queryText } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { CategoryRepository } from '../port/CategoryRepository';

export class CategoriesReadHandler implements OperationHandler<'catalog.categories.read', 'read'> {
  readonly operation = 'catalog.categories.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: OperationInputFor<'catalog.categories.read'>, context: HandlerContext<'catalog.categories.read'>): Promise<OperationReply<OperationOutputFor<'catalog.categories.read'>>> {
    requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.categories.read(context.transaction, queryText(input, 'q') ?? '', page);
    return { status: 200, body: keysetPage(rows, page, 'name') as OperationOutputFor<'catalog.categories.read'> };
  }
}
