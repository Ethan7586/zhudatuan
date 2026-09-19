import type { ArchBoard } from '@shop/l-kernel/arch';
import type { OperationUsecase } from '../foundation/application/OperationHandler';
import { token } from './Container';

export const ARCH_BOARD = token<ArchBoard>('arch.board');

/** The host resolves a hosted L through its existing session; Arch only sees its node and interface IDs. */
export function connectHostedOperation(usecase: OperationUsecase, arch: ArchBoard): OperationUsecase {
  return {
    async invoke(request) {
      const node = request.access?.actor.nodeContext;
      if (!node?.host_node_id) return usecase.invoke(request);
      const exchanged = await arch.exchange(node.node_id, request.type, request, (input) => usecase.invoke(input));
      if (!exchanged.connected) throw new Error('NOT_FOUND');
      return exchanged.output;
    },
  };
}
