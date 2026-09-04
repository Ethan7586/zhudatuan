import { OP_ORDER_IMPORTS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderImportSource } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class CreateOrderImport {
  constructor(private readonly port: Pick<OrderPort, 'createImport'>) {}
  execute(context: ConsoleContext, source: OrderImportSource, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_ORDER_IMPORTS_CREATE, identity);
    if (!(source.file instanceof File) || source.file.size < 1) throw new Error('VALIDATION_FAILED');
    return this.port.createImport(context, source, identity, signal);
  }
}
