import { describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../../../../platform/security/AccessContext';
import { ReadSupportContext } from './ReadSupportContext';
import { exactSupportScope, supportBoundary } from './SupportBoundary';

describe('SupportBoundary', () => {
  it.each([
    ['supplier', 'supplier', 'supplier:one'],
    ['store', 'store', 'store:one'],
  ] as const)('keeps the %s client inside its exact %s scope', (target, kind, id) => {
    const access = { actor: { target }, organization: 'enterprise:one', scope: { kind, id, path: [{ kind: 'enterprise', id: 'enterprise:one' }] } } as unknown as AccessContext;
    expect(exactSupportScope(access)).toBe(true);
    expect(supportBoundary(access)).toBe(id);
  });

  it('keeps console support hierarchical at its organization scope', () => {
    const access = { actor: { target: 'console' }, organization: 'enterprise:one', scope: { kind: 'enterprise', id: 'enterprise:one', path: [] } } as unknown as AccessContext;
    expect(exactSupportScope(access)).toBe(false);
    expect(supportBoundary(access)).toBe('enterprise:one');
  });

  it('does not ask the organization graph to widen a supplier scope', async () => {
    const descendants = vi.fn(async () => ['enterprise:one', 'mall:one']);
    const reader = new ReadSupportContext({ member: vi.fn(async () => 'member:one'), descendants } as never);
    const access = {
      actor: { id: 'actor:one', target: 'supplier' },
      membership: { id: 'membership:one' },
      organization: 'enterprise:one',
      scope: { kind: 'supplier', id: 'supplier:one', path: [] },
      trace: 'trace:one',
    } as unknown as AccessContext;

    await expect(reader.actor({} as never, { security: { kind: 'session', access } } as never)).resolves.toMatchObject({ scope: 'supplier:one', scopes: ['supplier:one'] });
    expect(descendants).not.toHaveBeenCalled();
  });
});
