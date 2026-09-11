import { describe, expect, it } from 'vitest';
import { ACCESS_CAPABILITIES, accessManifest } from '..';

describe('access module manifest', () => {
  it('keeps the stable access identity and lightweight public entry', () => {
    expect(accessManifest.id).toBe('access');
    expect(accessManifest.publicEntry).toBe('./index.ts');
    expect(accessManifest.provides).toEqual([ACCESS_CAPABILITIES.read, ACCESS_CAPABILITIES.manage]);
  });

  it('declares access operations, events, and module entrypoints', () => {
    expect(accessManifest.operations).toHaveLength(14);
    expect(accessManifest.publishes).toEqual([
      'access.owner.transfer.initiated',
      'access.owner.transferred',
      'access.owner.transfer.cancelled',
      'access.administrator.scope.changed',
      'access.administrator.member.noted',
    ]);
    expect(accessManifest.entrypoints.http).toEqual(['accessOperations', 'accessOperatorReadOperations']);
  });
});
