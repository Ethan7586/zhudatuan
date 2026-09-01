import { describe, expect, it, vi } from 'vitest';
import { transitionConsoleRoute } from './RouteTransition';

describe('transitionConsoleRoute', () => {
  it('finishes cancelling the previous route before mounting the next route', async () => {
    const order: string[] = [];
    let finishCancellation: (() => void) | undefined;
    const cancelQueries = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCancellation = () => {
            order.push('cancelled');
            resolve();
          };
        })
    );
    const navigate = vi.fn(() => {
      order.push('navigated');
    });

    const transition = transitionConsoleRoute({ cancelQueries } as never, navigate as never, '/scopes/mall/one/experience');

    expect(navigate).not.toHaveBeenCalled();
    finishCancellation?.();
    await transition;

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['console'] });
    expect(navigate).toHaveBeenCalledWith('/scopes/mall/one/experience');
    expect(order).toEqual(['cancelled', 'navigated']);
  });
});
