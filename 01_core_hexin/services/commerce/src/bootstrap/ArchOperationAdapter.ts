import type { ArchBoard } from '@shop/l-kernel/arch';
import type { OperationUsecase } from '../foundation/application/OperationHandler';
import { token } from './Container';

export const ARCH_BOARD = token<ArchBoard>('arch.board');

/** The host resolves a hosted L through its existing session; Arch only sees its node and interface IDs. */
export function connectHostedOperation(usecase: OperationUsecase, arch: ArchBoard | undefined): OperationUsecase {
  if (arch === undefined) return usecase;
  return {
    async invoke(request) {
      const node = request.access?.actor.nodeContext;
      if (!node?.host_node_id) return usecase.invoke(request);
      // A hosted L inherits an already registered host interface on first use.
      // mountAll preserves an explicit disconnect or removal for that hosted node.
      arch.mountAll([node.node_id], [request.type]);
      const exchanged = await arch.exchange(node.node_id, request.type, request, (input) => usecase.invoke(input));
      if (!exchanged.connected) throw new Error('NOT_FOUND');
      return exchanged.output;
    },
  };
}
