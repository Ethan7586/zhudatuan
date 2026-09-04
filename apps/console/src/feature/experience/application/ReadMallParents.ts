import { OP_ORGANIZATION_LAYERS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { MallPort } from '../public';

export class ReadMallParents {
  constructor(private readonly malls: MallPort) {}
  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_LAYERS_READ);
    return this.malls.parents(context, signal);
  }
}
