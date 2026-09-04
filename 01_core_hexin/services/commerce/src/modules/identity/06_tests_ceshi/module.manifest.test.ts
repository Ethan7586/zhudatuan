import { describe, expect, it } from 'vitest';
import { IDENTITY_CAPABILITIES } from '../01_public_gongkai/IdentityCapabilities';
import { IDENTITY_CORE_OPERATION_IDS } from '../05_interface_jieru/http/IdentityOperations';
import { identityManifest } from '../module.manifest';

describe('identity module manifest', () => {
  it('keeps the stable identity contract', () => {
    expect(identityManifest.id).toBe('identity');
    expect(identityManifest.publicEntry).toBe('./index.ts');
    expect(identityManifest.provides).toEqual([
      IDENTITY_CAPABILITIES.read,
      IDENTITY_CAPABILITIES.manage,
    ]);
    expect(identityManifest.operations).toEqual([
      ...IDENTITY_CORE_OPERATION_IDS,
      'identity.wechat.session',
      'identity.wechat.bind',
    ]);
    expect(identityManifest.layers).toEqual([
      'public',
      'domain',
      'application',
      'adapters',
      'interface',
      'tests',
    ]);
  });
});
