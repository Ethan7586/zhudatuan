import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, integerField, nullableText, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { CategoryRepository } from '../port/CategoryRepository';

export class CategoriesCreateHandler implements OperationHandler<'catalog.categories.create', 'write'> {
  readonly operation = 'catalog.categories.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: OperationInputFor<'catalog.categories.create'>, context: WriteHandlerContext<'catalog.categories.create'>): Promise<OperationReply<OperationOutputFor<'catalog.categories.create'>>> {
    const access = requireSession(context.security);
    if (access.scope.kind !== 'platform') throw new DomainError('SCOPE_DENIED');
    const body = bodyRecord(input);
    const category = await this.categories.create(context.transaction, {
      name: textField(body, 'name'),
      parent: nullableText(body, 'parent'),
      sort: body.sort === undefined ? 0 : integerField(body, 'sort'),
    });
    return { status: 201, body: category as OperationOutputFor<'catalog.categories.create'> };
  }
}
