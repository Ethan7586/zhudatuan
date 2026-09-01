import { describe, expect, it } from 'vitest';
import { authenticationOperationResult } from '../application/service/AuthenticationStrategy';

describe('authentication operation result', () => {
  it('maps every authentication result into the public operation body', () => {
    const result = authenticationOperationResult({
      status: 201,
      headers: { 'set-cookie': 'session=redacted' },
      result: { kind: 'session', ticket: 'ticket:one', returnTarget: 'return:one' },
    });

    expect(result).toEqual({
      status: 201,
      headers: { 'set-cookie': 'session=redacted' },
      body: { kind: 'session', ticket: 'ticket:one', returnTarget: 'return:one' },
    });
  });
});
