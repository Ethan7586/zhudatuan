import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { FederationCenter, FederationHealth } from '../model/Federation';

export interface FederationPort {
  read(context: ConsoleContext, signal?: AbortSignal): Promise<FederationCenter>;
  test(context: ConsoleContext, provider: string, identity: string, signal?: AbortSignal): Promise<FederationHealth>;
  createIdentity(): string;
}
