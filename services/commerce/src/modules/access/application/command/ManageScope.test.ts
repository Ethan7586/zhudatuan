import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import { Scope } from '../../domain/model/Scope';
import type { AccessRepository } from '../port/AccessRepository';
import type { AccessVersionService } from '../service/AccessVersionService';
import { ManageScope } from './ManageScope';

describe('ManageScope', () => {
  it('resolves the canonical scope path and bumps the target exactly once', async () => {
    const scopePath = vi.fn(async () => '[{"kind":"tenant","id":"tenant:one"}]');
    const grantScope = vi.fn(
      async (_database: OperationDatabase, input: Readonly<{ id: string }>) =>
        new Scope({ id: input.id, membership: 'membership:target', kind: 'mall', resource: 'mall:one', path: '[{"kind":"tenant","id":"tenant:one"}]', effect: 'deny', expiresAt: null })
    );
    const bump = vi.fn(async () => 12);
    const command = new ManageScope({ scopePath, grantScope } as unknown as AccessRepository, { bump } as unknown as AccessVersionService);
    const response = await command.execute(request(), {} as OperationDatabase);
    expect(scopePath).toHaveBeenCalledWith(expect.anything(), 'mall:one', 'mall');
    expect(grantScope).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ membership: 'membership:target', kind: 'mall', scope: 'mall:one', effect: 'deny', expectedVersion: 11 }));
    expect(bump).toHaveBeenCalledWith(expect.anything(), 'membership:target', 'scopegrantchanged', 'trace:scope');
    expect(response).toMatchObject({ status: 200, body: { membershipId: 'membership:target', kind: 'mall', scope: 'mall:one', effect: 'deny', expiresAt: null, accessVersion: 12 } });
  });
});

function request(): OperationRequest {
  return {
    type: 'access.scopes.manage',
    input: {
      path: {},
      query: {},
      headers: {},
      body: { targetMembership: 'membership:target', kind: 'mall', scope: 'mall:one', effect: 'deny' },
      rawBody: '',
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
      expectedVersion: 11,
      idempotency: 'scope-change',
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:admin', session: 'session:admin', membership: 'membership:admin', credentialVersion: 1, accessVersion: 4, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:admin', active: true, accessVersion: 4, permissions: { allows: new Set(['access.scope.manage']), denies: new Set() }, scopes: [] },
        organization: 'tenant:one',
        scope: { id: 'tenant:one', kind: 'tenant', path: [] },
        accessVersion: 4,
        capabilities: new Set(['access.scopes.manage']),
        capabilityVersion: 1,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:scope',
      },
    },
  };
}
