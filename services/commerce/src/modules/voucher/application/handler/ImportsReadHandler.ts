import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ImportRepository } from '../port/ImportRepository';

export class ImportsReadHandler implements OperationHandler<'voucher.imports.read', 'read'> {
  readonly operation = 'voucher.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly imports: ImportRepository) {}
  async execute(input: OperationInputFor<'voucher.imports.read'>, context: HandlerContext<'voucher.imports.read'>) {
    const result = await this.imports.readImport(context.transaction, input, context);
    return result;
  }
}
