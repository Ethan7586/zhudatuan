import type { OperationOutputFor } from '@shop/contract';
import type { MembershipSelection } from '../model/Membership';

export function mapMemberships(value: OperationOutputFor<'identity.federations.selection.read'>): MembershipSelection {
  return Object.freeze({ memberships: Object.freeze(value.memberships.map((membership) => Object.freeze(membership))), expiresAt: value.expiresAt, target: value.target });
}
