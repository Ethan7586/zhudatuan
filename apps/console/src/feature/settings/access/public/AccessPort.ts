import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessChange, AccessPage, AccessReceipt, OwnerChange, Ownership, OwnershipPreview } from '../model/Access';

export interface AccessPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<AccessPage>;
  readOwnership(context: ConsoleContext, signal?: AbortSignal): Promise<Ownership>;
  previewOwnership(context: ConsoleContext, change: OwnerChange, identity: string, signal?: AbortSignal): Promise<OwnershipPreview>;
  prepare(change: AccessChange, makerMembership: string, scope: string): Promise<string>;
  execute(context: ConsoleContext, change: AccessChange, proof: string, identity: string, signal?: AbortSignal): Promise<AccessReceipt>;
  createIdentity(): string;
}
