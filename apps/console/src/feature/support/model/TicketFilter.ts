import type { OperationInputFor } from '@shop/contract';

export type TicketFilter = NonNullable<OperationInputFor<'support.cases.read'>['query']>;

export function filterSignature(filter: TicketFilter): string {
  return JSON.stringify(Object.entries(filter).sort(([left], [right]) => left.localeCompare(right)));
}
