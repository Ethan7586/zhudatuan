import { OperationCatalog, type ApiErrorCode, type OperationId } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../platform/error/ApplicationError';
import { ErrorPresenter } from './ErrorPresenter';

describe('ErrorPresenter', () => {
  it('maps a reused idempotency key to the canonical conflict', async () => {
    const response = new ErrorPresenter().map(new ApplicationError('IDEMPOTENCY_CONFLICT'), 'request:one', operationFor('IDEMPOTENCY_CONFLICT'));
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', requestId: 'request:one' });
  });

  it('maps employee transaction failures from the generated error contract', () => {
    const mapper = new ErrorPresenter();
    for (const code of ['INVENTORY_INSUFFICIENT', 'CART_EMPTY', 'PRICE_QUOTE_EXPIRED', 'BENEFIT_BALANCE_INSUFFICIENT', 'LISTING_NOT_PURCHASABLE'] as const) {
      const response = mapper.map(new ApplicationError(code), 'request:employee', operationFor(code));
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code, requestId: 'request:employee' });
    }
  });

  it('does not infer a status from an unregistered error name', () => {
    const response = new ErrorPresenter().map(new Error(['UNREGISTERED', 'INVALID'].join('_')), 'request:unknown');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId: 'request:unknown', retryable: true });
  });

  it('never exposes raw registered-looking errors without a typed boundary error', () => {
    const response = new ErrorPresenter().map(new Error('CREDENTIAL_INVALID'), 'request:raw');
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId: 'request:raw', retryable: true });
  });

  it('only exposes an allowlisted validation field and drops arbitrary typed details', () => {
    const mapper = new ErrorPresenter();
    expect(mapper.map(new ApplicationError('VALIDATION_FAILED', { field: 'membership.id', secret: 'never' }), 'request:validation', operationFor('VALIDATION_FAILED')).body).toMatchObject({ details: { field: 'membership.id' } });
    expect(mapper.map(new ApplicationError('PERMISSION_DENIED', { operation: 'secret.operation' }), 'request:denied', operationFor('PERMISSION_DENIED')).body).not.toHaveProperty('details');
  });

  it('hides typed errors not declared by the current operation', () => {
    const response = new ErrorPresenter().map(new ApplicationError('CREDENTIAL_INVALID'), 'request:wrong-union', operationFor('CART_EMPTY'));
    expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('maps a catalogued HTTP boundary failure only through its operation union', () => {
    const response = new ErrorPresenter().map(new ApplicationError('REQUEST_JSON_INVALID'), 'request:boundary', 'identity.sessions.create');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'REQUEST_JSON_INVALID', requestId: 'request:boundary' });

    const withoutOperation = new ErrorPresenter().map(new ApplicationError('REQUEST_JSON_INVALID'), 'request:startup');
    expect(withoutOperation.body).toMatchObject({ code: 'INTERNAL_ERROR' });

    const impossibleForRead = new ErrorPresenter().map(new ApplicationError('REQUEST_JSON_INVALID'), 'request:read', 'identity.providers.read');
    expect(impossibleForRead.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

function operationFor(code: ApiErrorCode): OperationId {
  const operation = OperationCatalog.all().find((candidate) => new Set<ApiErrorCode>(candidate.errorUnion).has(code));
  if (operation === undefined) throw new Error('TEST_OPERATION_MISSING');
  return operation.id;
}
