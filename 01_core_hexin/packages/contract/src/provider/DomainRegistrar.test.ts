import { describe, expect, it } from 'vitest';
import type { DomainRegistrarPort } from './DomainRegistrar';

describe('DomainRegistrarPort', () => {
  it('exposes registration only and leaves DNS, TLS and publication outside the socket', () => {
    const registrar: DomainRegistrarPort = {
      quote: (_context, request) => Promise.resolve({
        providerId: 'fake', quoteId: 'quote:one', domainAscii: request.domainAscii,
        registrationYears: request.registrationYears, availability: 'unavailable',
        checkedAt: '2026-09-03T12:00:00.000Z', expiresAt: '2026-09-03T12:05:00.000Z',
      }),
      purchase: (_context, command) => Promise.resolve({
        providerId: command.quote.providerId, externalReference: 'registration:one',
        domainAscii: command.quote.domainAscii, state: 'submitted', submittedAt: '2026-09-03T12:01:00.000Z',
      }),
      read: () => Promise.resolve({
        providerId: 'fake', externalReference: 'registration:one', domainAscii: 'example.com',
        state: 'registered', submittedAt: '2026-09-03T12:01:00.000Z', checkedAt: '2026-09-03T12:02:00.000Z',
      }),
    };

    expect(Object.keys(registrar).sort()).toEqual(['purchase', 'quote', 'read']);
  });
});
