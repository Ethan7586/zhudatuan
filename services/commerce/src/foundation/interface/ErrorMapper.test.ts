import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../domain/ApplicationError';
import { ErrorMapper } from './ErrorMapper';

describe('ErrorMapper', () => {
  it('maps a reused idempotency key to conflict', async () => {
    const response = new ErrorMapper().map(new ApplicationError('IDEMPOTENCY_KEY_REUSED'), 'request:one');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', requestId: 'request:one' });
  });

  it('maps employee transaction failures from the generated error contract', () => {
    const mapper = new ErrorMapper();
    for (const code of ['INVENTORY_INSUFFICIENT', 'CART_EMPTY', 'PRICE_QUOTE_EXPIRED', 'BENEFIT_BALANCE_INSUFFICIENT', 'LISTING_NOT_PURCHASABLE'] as const) {
      const response = mapper.map(new ApplicationError(code), 'request:employee');
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code, requestId: 'request:employee' });
    }
  });

  it('does not infer a status from an unregistered error name', () => {
    const response = new ErrorMapper().map(new Error(['UNREGISTERED', 'INVALID'].join('_')), 'request:unknown');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId: 'request:unknown', retryable: true });
  });

  it('never exposes raw registered-looking errors without a typed boundary error', () => {
    const response = new ErrorMapper().map(new Error('CREDENTIAL_INVALID'), 'request:raw');
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId: 'request:raw', retryable: true });
  });

  it('only exposes an allowlisted validation field and drops arbitrary typed details', () => {
    const mapper = new ErrorMapper();
    expect(mapper.map(new ApplicationError('VALIDATION_FAILED', { field: 'membership.id', secret: 'never' }), 'request:validation').body).toMatchObject({ details: { field: 'membership.id' } });
    expect(mapper.map(new ApplicationError('PERMISSION_DENIED', { operation: 'secret.operation' }), 'request:denied').body).not.toHaveProperty('details');
  });
});
