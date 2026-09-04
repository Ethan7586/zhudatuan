import type { OperationOutputFor } from '@shop/contract';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { DeepReadonly } from '../model/Immutable';

export type ScopeOption = DeepReadonly<OperationOutputFor<'organization.layers.read'>['items'][number]>;

export interface ScopeCatalog {
  read(context: ConsoleContext, signal?: AbortSignal): Promise<readonly ScopeOption[]>;
}
