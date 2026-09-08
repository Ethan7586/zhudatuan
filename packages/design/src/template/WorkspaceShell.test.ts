import { describe, expect, it } from 'vitest';
import { resolveWorkspacePath } from './WorkspaceShell';

const items = Object.freeze([
  { path: '/reporting', title: '经营看板' },
  { path: '/orders', title: '订单管理' },
]);

describe('workspace route resolution', () => {
  it('uses the first permitted surface only for the application root', () => {
    expect(resolveWorkspacePath('/', items)).toBe('/reporting');
    expect(resolveWorkspacePath('/', [])).toBeUndefined();
  });

  it('preserves an unknown path so the application renders not found', () => {
    expect(resolveWorkspacePath('/unknown', items)).toBe('/unknown');
  });
});
