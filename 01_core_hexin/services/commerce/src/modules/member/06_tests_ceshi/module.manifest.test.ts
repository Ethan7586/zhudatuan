import { describe, expect, it } from 'vitest';
import { MEMBER_CAPABILITIES, memberManifest } from '..';

describe('member module manifest', () => {
  it('keeps the stable member identity and lightweight public entry', () => {
    expect(memberManifest.id).toBe('member');
    expect(memberManifest.publicEntry).toBe('./index.ts');
    expect(memberManifest.provides).toEqual([MEMBER_CAPABILITIES.read, MEMBER_CAPABILITIES.manage]);
  });

  it('declares member operations and entrypoints', () => {
    expect(memberManifest.operations).toHaveLength(16);
    expect(memberManifest.operations).toContain('member.malls.open');
    expect(memberManifest.operations).toContain('member.storefront.members.read');
    expect(memberManifest.operations).toContain('member.storefront.detail.read');
    expect(memberManifest.operations).toContain('member.storefront.invitees.read');
    expect(memberManifest.operations).toContain('member.storefront.orders.read');
    expect(memberManifest.operations).toContain('member.storefront.config.manage');
    expect(memberManifest.operations).toContain('member.storefront.custom.manage');
    expect(memberManifest.entrypoints.http).toEqual(['memberOperations', 'memberOperatorReadOperations']);
    expect(memberManifest.entrypoints.jobs).toEqual(['memberimport']);
  });
});
