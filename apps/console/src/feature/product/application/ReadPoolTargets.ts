import { OP_ORGANIZATION_LAYERS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ScopeCatalog } from '../../../shared/scope/ScopeCatalog';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';

export class ReadPoolTargets {
  constructor(private readonly scopes: ScopeCatalog) {}

  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_LAYERS_READ);
    return this.scopes.read(context, signal);
  }
}
