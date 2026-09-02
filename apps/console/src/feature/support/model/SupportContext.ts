import type { OperationOutputFor } from '@shop/contract';

export type SupportContext = OperationOutputFor<'support.messages.read'>['context'];
