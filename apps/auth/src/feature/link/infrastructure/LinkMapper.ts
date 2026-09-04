import type { OperationOutputFor } from '@shop/contract';
import type { LinkSnapshot } from '../model/Link';
export class LinkMapper {
  map(value: OperationOutputFor<'identity.links.read'>): LinkSnapshot {
    return Object.freeze({ links: Object.freeze(value.items.map(({ id, provider, status, version }) => Object.freeze({ id, provider, status, version }))) });
  }
}
