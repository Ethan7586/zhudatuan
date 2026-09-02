import type { Scope } from '@shop/authz';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Actor } from './AccessContext';
import { PgGovernanceResolver } from './GovernanceResolver';

const RESOLVED_AT = new Date('2026-09-02T05:30:00.000Z');
const ACTOR: Actor = Object.freeze({
  id: 'principal:successor-owner', session: 'session:owner', membership: 'membership:successor-owner',
  credentialVersion: 3, accessVersion: 7, target: 'console', assurance: { level: 2 },
});
const MEMBERSHIP = Object.freeze({ id: ACTOR.membership, active: true, accessVersion: 7, denies: [], grants: [] });

describe('PgGovernanceResolver canonical Owner identity', () => {
  it.each([
    ['platform', 'organization-platform-root', 'organization-platform-root'],
    ['tenant', 'tenant-zhudatuan', 'tenant-zhudatuan'],
    ['self', ACTOR.id, `self:${ACTOR.id}`],
    ['owner', 'member:successor-owner', 'member:successor-owner'],
  ] as const)('keeps the exact Owner identity under %s scope', async (kind, id, storageId) => {
    const query = vi.fn().mockResolvedValue({ rows: [row(kind, id, storageId, true)] });
    const resolver = new PgGovernanceResolver({ query } as never);

    await expect(resolver.resolve(ACTOR, MEMBERSHIP, scope(kind, id))).resolves.toMatchObject({
      governanceLevel: 'owner', isExactOwner: true,
      actorMembershipId: ACTOR.membership, actorPrincipalId: ACTOR.id,
      ownerMembershipId: ACTOR.membership,
      scope: { kind, semanticId: id, storageId },
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('access.resolve_governance($1,$2,$3,$4)'),
      [ACTOR.membership, ACTOR.id, kind, id]);
  });

  it('never promotes an ordinary operator from its scope encoding', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row('tenant', 'tenant-zhudatuan', 'tenant-zhudatuan', false)] });
    const resolver = new PgGovernanceResolver({ query } as never);

    await expect(resolver.resolve(ACTOR, MEMBERSHIP, scope('tenant', 'tenant-zhudatuan'))).resolves.toMatchObject({
      governanceLevel: 'administrator', isExactOwner: false,
    });
  });

  it('fails closed when the database identity does not match the authenticated actor', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ...row('self', ACTOR.id, `self:${ACTOR.id}`, true), actor_principal_id: 'principal:other' }] });
    const resolver = new PgGovernanceResolver({ query } as never);

    await expect(resolver.resolve(ACTOR, MEMBERSHIP, scope('self', ACTOR.id))).rejects.toThrow('GOVERNANCE_CONTEXT_MISMATCH');
  });
});

describe('governance identity inference audit', () => {
  it('keeps identity and member business code free of duplicate Owner inference', async () => {
    const files = [
      'src/modules/identity/IdentityOperations.ts',
      'src/modules/member/MemberReadOperations.ts',
    ];
    for (const file of files) {
      const source = await readFile(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/role-platform-owner-v2|access\.platformowner|zhudatuan_owner_context|\/owner\/i/);
    }
  });
});

function scope(kind: Scope['kind'], id: string): Scope {
  return { kind, id, ...(kind === 'tenant' ? { tenant: id } : {}), path: [] };
}

function row(kind: Scope['kind'], semanticId: string, storageId: string, exactOwner: boolean) {
  return {
    governance_level: exactOwner ? 'owner' : 'administrator', is_exact_owner: exactOwner,
    actor_membership_id: ACTOR.membership, actor_principal_id: ACTOR.id, organization_id: 'tenant-zhudatuan',
    owner_membership_id: exactOwner ? ACTOR.membership : 'membership:real-owner',
    scope_kind: kind, scope_semantic_id: semanticId, scope_storage_id: storageId,
    scope_organization_id: kind === 'self' || kind === 'owner' ? null : 'tenant-zhudatuan', resolved_at: RESOLVED_AT,
  } as const;
}
