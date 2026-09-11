import { describe, expect, it } from 'vitest';
import { accessModule } from './manifest';

describe('access module navigation', () => {
  it('opens the administrator directory by default and keeps role templates as a child page', () => {
    expect(accessModule.routes.find(({ kind }) => kind === 'entry')?.path).toBe('settings/members');
    expect(accessModule.routes.find(({ path }) => path === 'settings/access')?.kind).toBe('child');
  });
});
