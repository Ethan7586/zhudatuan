import type { RequestHandler } from 'msw';
import { setupServer } from 'msw/node';

export interface MswHarness {
  readonly server: ReturnType<typeof setupServer>;
  readonly start: () => void;
  readonly reset: () => void;
  readonly stop: () => void;
}

export function createMswHarness(...handlers: readonly RequestHandler[]): MswHarness {
  const server = setupServer(...handlers);
  return {
    server,
    start: () => server.listen({ onUnhandledRequest: 'error' }),
    reset: () => server.resetHandlers(),
    stop: () => server.close(),
  };
}
