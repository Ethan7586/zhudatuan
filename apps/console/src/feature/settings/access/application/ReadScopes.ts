import { OP_ORGANIZATION_LAYERS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { ScopeCatalog } from '../../../../shared/scope/ScopeCatalog';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';

export class ReadScopes {
  constructor(private readonly catalog: ScopeCatalog) {}

  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_LAYERS_READ);
    return this.catalog.read(context, signal);
  }
}
