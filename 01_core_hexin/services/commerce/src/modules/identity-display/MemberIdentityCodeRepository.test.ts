import { PGlite } from '@electric-sql/pglite';
import { allocateMemberSuffixes, allocateStorefrontSegment } from '@shop/l-kernel/member-identity-code';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { assignMemberIdentityCodes, memberIdentityRepositoryAvailable } from './MemberIdentityCodeRepository';
import { resolveIdentityDisplayMembership } from './IdentityDisplayPresenter';

async function database(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`create schema identity_display; create schema organization;
    create table organization.node(id text primary key,mall_id text,node_profile text,status text);
    create table identity_display.member_store_segment(
      context_id text primary key,storefront_node_id text unique,segment text unique
    );
    create table identity_display.member_code_mapping(
      context_id text not null,membership_id text primary key,suffix text not null,code text unique,
      unique(context_id,suffix)
    );
    insert into organization.node values
      ('node:hbbtzn:l1','mall:l1','operating_mall','active'),
      ('node:l2a','mall:l2a','operating_mall','active');`);
  return db;
}

describe('MB global 4+4 repository', () => {
  it('keeps codes stable and unique across STs while allocating a whole page', async () => {
    const db = await database();
    try {
      const store = db as unknown as OperationDatabase;
      expect(await memberIdentityRepositoryAvailable(store)).toBe(true);
      const l1 = await assignMemberIdentityCodes(store, 'mall:l1', ['membership:b', 'membership:a']);
      expect([...l1.values()]).toEqual(['MB-QS1KJR6R', 'MB-QS1KNA8Q']);
      expect(await assignMemberIdentityCodes(store, 'mall:l1', ['membership:a', 'membership:b'])).toEqual(l1);
      const l2 = await assignMemberIdentityCodes(store, 'mall:l2a', ['membership:l2a']);
      expect(l2.get('membership:l2a')).toMatch(/^MB-[0-9A-HJKMNP-Z]{8}$/);
      expect(l2.get('membership:l2a')?.slice(3, 7)).not.toBe(l1.get('membership:a')?.slice(3, 7));
      expect(await resolveIdentityDisplayMembership(store, 'mall:l1', 'member', l1.get('membership:a')!))
        .toBe('membership:a');
      expect(await resolveIdentityDisplayMembership(store, 'mall:l2a', 'member', l1.get('membership:a')!))
        .toBeUndefined();
      expect(await resolveIdentityDisplayMembership(store, 'mall:l1', 'member', 'MB-4F9Q2A'))
        .toBeUndefined();
    } finally {
      await db.close();
    }
  });

  it('reassigns both prefix and suffix collisions without changing reserved codes', async () => {
    const db = await database();
    try {
      const store = db as unknown as OperationDatabase;
      const prefix = allocateStorefrontSegment('node:hbbtzn:l1', null, new Set());
      const suffix = allocateMemberSuffixes('node:hbbtzn:l1', ['membership:a'], new Map(), new Set()).get('membership:a')!;
      await db.query(`insert into identity_display.member_store_segment values($1,$2,$3)`,
        ['mall:reserved', 'node:reserved', prefix]);
      const first = await assignMemberIdentityCodes(store, 'mall:l1', ['membership:initial']);
      expect(first.get('membership:initial')?.slice(3, 7)).not.toBe(prefix);
      const chosenPrefix = first.get('membership:initial')!.slice(3, 7);
      await db.query(`insert into identity_display.member_code_mapping values($1,$2,$3,$4)`,
        ['mall:l1', 'membership:reserved', suffix, `MB-${chosenPrefix}${suffix}`]);
      const next = await assignMemberIdentityCodes(store, 'mall:l1', ['membership:reserved', 'membership:a']);
      expect(next.get('membership:reserved')).toBe(`MB-${chosenPrefix}${suffix}`);
      expect(next.get('membership:a')).not.toBe(next.get('membership:reserved'));
    } finally {
      await db.close();
    }
  });

  it('does not assign when the ST node is ambiguous or missing', async () => {
    const db = await database();
    try {
      const store = db as unknown as OperationDatabase;
      expect(await assignMemberIdentityCodes(store, 'mall:missing', ['membership:one'])).toEqual(new Map());
      await db.query(`insert into organization.node values($1,$2,'operating_mall','active')`, ['node:duplicate', 'mall:l1']);
      expect(await assignMemberIdentityCodes(store, 'mall:l1', ['membership:one'])).toEqual(new Map());
    } finally {
      await db.close();
    }
  });
});
