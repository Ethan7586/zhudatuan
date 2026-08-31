import { describe, expect, it } from 'vitest';
import { ErrorMapper } from './ErrorMapper';

describe('ErrorMapper', () => {
  it('maps a reused idempotency key to conflict', async () => {
    const response = new ErrorMapper().map(new Error('IDEMPOTENCY_KEY_REUSED'), 'request:one');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', requestId: 'request:one' });
  });

  it('maps employee transaction failures from the generated error contract', () => {
    const mapper = new ErrorMapper();
    for (const code of ['INVENTORY_INSUFFICIENT', 'CART_EMPTY', 'PRICE_QUOTE_EXPIRED', 'BENEFIT_BALANCE_INSUFFICIENT', 'LISTING_NOT_PURCHASABLE']) {
      const response = mapper.map(new Error(code), 'request:employee');
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code, requestId: 'request:employee' });
    }
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('maps bounded invitation scope failures to safe client errors', () => {
    const mapper = new ErrorMapper();
    for (const code of ['INVITATION_SCOPE_INVALID', 'INVITATION_STOREFRONT_SCOPE_REQUIRED', 'STOREFRONT_SCOPE_REQUIRED']) {
      const response = mapper.map(new Error(code), 'request:invitation');
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code, requestId: 'request:invitation' });
    }
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('does not infer a status from an unregistered error name', () => {
    const response = new ErrorMapper().map(new Error(['UNREGISTERED', 'INVALID'].join('_')), 'request:unknown');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId: 'request:unknown' });
  });
});
