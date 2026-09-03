export type DomainPurchaseState =
  | 'draft'
  | 'quoted'
  | 'approved'
  | 'submitted'
  | 'registered'
  | 'failed'
  | 'quote_expired'
  | 'cancelled';

export type DomainPurchaseEvent =
  | 'quote_received'
  | 'approval_recorded'
  | 'purchase_submitted'
  | 'provider_registered'
  | 'provider_failed'
  | 'quote_expired'
  | 'cancelled';

const transitions: Readonly<Record<DomainPurchaseState, Readonly<Partial<Record<DomainPurchaseEvent, DomainPurchaseState>>>>> = {
  draft: { quote_received: 'quoted', cancelled: 'cancelled' },
  quoted: { quote_received: 'quoted', approval_recorded: 'approved', quote_expired: 'quote_expired', cancelled: 'cancelled' },
  approved: { purchase_submitted: 'submitted', quote_expired: 'quote_expired', cancelled: 'cancelled' },
  submitted: { provider_registered: 'registered', provider_failed: 'failed' },
  failed: { quote_received: 'quoted', cancelled: 'cancelled' },
  quote_expired: { quote_received: 'quoted', cancelled: 'cancelled' },
  registered: {},
  cancelled: {},
};

/** Registration ends at `registered`; DNS, TLS and publication are intentionally not lifecycle states here. */
export class DomainPurchaseLifecycle {
  transition(state: DomainPurchaseState, event: DomainPurchaseEvent): DomainPurchaseState {
    const next = transitions[state]?.[event];
    if (!next) throw new Error(`DOMAIN_PURCHASE_TRANSITION_INVALID:${state}:${event}`);
    return next;
  }
}
