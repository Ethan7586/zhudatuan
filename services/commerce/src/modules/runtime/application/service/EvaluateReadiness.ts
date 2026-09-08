import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import { finalizeRuntimeReadiness, runtimeReadinessCheckpoint, type RuntimeReadinessCheckpoint, type RuntimeReadinessState } from '../../../../composition/RuntimeReadiness';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export type ReadinessCheckpoint = RuntimeReadinessCheckpoint;
export type ReadinessState = RuntimeReadinessState;

export class EvaluateReadiness {
  constructor(
    private readonly extensions: ExtensionRegistry,
    private readonly invitationKeyVersions: readonly string[]
  ) {}

  checkpoint(context: ReadTransactionContext): Promise<ReadinessCheckpoint> {
    return runtimeReadinessCheckpoint(context, 'shopapp', this.invitationKeyVersions);
  }

  finalize(checkpoint: ReadinessCheckpoint): Promise<ReadinessState> {
    return finalizeRuntimeReadiness(checkpoint, this.extensions);
  }
}
