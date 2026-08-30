import { ApiError } from '@shop/sdk';
import { describe, expect, it } from 'vitest';
import { routeErrorStatus } from './RouteError';

describe('route error authorization boundary', () => {
  it('preserves API authorization status instead of misclassifying it as a console failure', () => {
    expect(routeErrorStatus(new ApiError('SESSION_EXPIRED', 401, 'request:1'))).toBe(401);
    expect(routeErrorStatus(new ApiError('SCOPE_NOT_GRANTED', 403, 'request:2'))).toBe(403);
    expect(routeErrorStatus(new Error('NETWORK_FAILURE'))).toBe(500);
  });
});
