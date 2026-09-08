import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand } from '../../../shared/api/RequestContext';
import type { OrderListFilter } from '../model/OrderFilter';

export function orderFilterQuery(filter: OrderListFilter) {
  return {
    ...(filter.search === '' ? {} : { search: filter.search }),
    ...(filter.placed === '' ? {} : { placed: filter.placed as never }),
    ...(filter.from === '' ? {} : { from: instant(filter.from, false) }),
    ...(filter.to === '' ? {} : { to: instant(filter.to, true) }),
    ...(filter.lifecycle === '' ? {} : { lifecycle: filter.lifecycle as never }),
    ...(filter.payment === '' ? {} : { payment: filter.payment as never }),
    ...(filter.fulfillment === '' ? {} : { fulfillment: filter.fulfillment as never }),
    ...(filter.mall === '' ? {} : { mall: filter.mall }),
    ...(filter.channel === '' ? {} : { channel: filter.channel }),
    ...(filter.product === '' ? {} : { product: filter.product }),
    ...(filter.member === '' ? {} : { member: filter.member }),
    ...(filter.minimumMinor === '' ? {} : { minimumMinor: Number(filter.minimumMinor) }),
    ...(filter.maximumMinor === '' ? {} : { maximumMinor: Number(filter.maximumMinor) }),
  } as const;
}

export function command(context: ConsoleContext, identity: string, signal?: AbortSignal, expectedVersion?: number, proof?: string) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(proof === undefined ? {} : { proof }),
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}

export function instant(value: string, end: boolean): string {
  const source = value.includes('T') ? value : `${value}T${end ? '23:59:59.999' : '00:00:00.000'}`;
  return new Date(source).toISOString();
}
