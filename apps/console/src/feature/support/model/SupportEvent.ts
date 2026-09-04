import type { OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

export type SupportEvent = DeepReadonly<OperationOutputFor<'support.events.read'>>;
