import { describe, expect, it } from 'vitest';
import { RouteRegistry } from './RouteRegistry';

describe('RouteRegistry operation allowlist', () => {
  it('registers only explicitly approved operations and keeps every other contract route closed', () => {
    const routes = new RouteRegistry(['support.cases.read']);
    const handler = async () => ({ status: 200, body: {} });
    routes.register({ operation: 'support.cases.read', handler });
    routes.register({ operation: 'support.messages.send', handler });
    routes.freeze();

    expect(routes.catalog()).toEqual([{ operation: 'support.cases.read', method: 'GET', path: '/api/v1/support/cases' }]);
    expect(routes.match('GET', '/api/v1/support/cases')?.operation).toBe('support.cases.read');
    expect(routes.match('POST', '/api/v1/support/cases/case%3Aone/messages')).toBeNull();
  });
});
