import { describe, expect, it } from 'vitest';
import { DomainPurchaseLifecycle } from './DomainPurchaseLifecycle';

describe('DomainPurchaseLifecycle', () => {
  const lifecycle = new DomainPurchaseLifecycle();

  it('requires quote and approval before the irreversible registrar submission', () => {
    const quoted = lifecycle.transition('draft', 'quote_received');
    const approved = lifecycle.transition(quoted, 'approval_recorded');
    const submitted = lifecycle.transition(approved, 'purchase_submitted');
    const registered = lifecycle.transition(submitted, 'provider_registered');

    expect([quoted, approved, submitted, registered]).toEqual(['quoted', 'approved', 'submitted', 'registered']);
  });

  it('cannot skip approval, cancel an uncertain submission, or treat registration as DNS activation', () => {
    expect(() => lifecycle.transition('draft', 'purchase_submitted')).toThrow('DOMAIN_PURCHASE_TRANSITION_INVALID');
    expect(() => lifecycle.transition('submitted', 'cancelled')).toThrow('DOMAIN_PURCHASE_TRANSITION_INVALID');
    expect(() => lifecycle.transition('registered', 'quote_received')).toThrow('DOMAIN_PURCHASE_TRANSITION_INVALID');
  });

  it('allows a failed or expired quote to be replaced without replaying the old approval', () => {
    expect(lifecycle.transition('failed', 'quote_received')).toBe('quoted');
    expect(lifecycle.transition('quote_expired', 'quote_received')).toBe('quoted');
    expect(lifecycle.transition('approved', 'quote_expired')).toBe('quote_expired');
  });
});
