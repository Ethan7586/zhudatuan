import { describe, expect, it, vi } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { ObjectStore } from '../../public/ObjectPort';
import { RuntimeAssets } from './RuntimeAssets';

describe('RuntimeAssets', () => {
  it('authorizes a long-lived asset upload and signs only a short-lived read URL', async () => {
    const authorizeUpload = vi.fn(async (input) => ({
      reference: 'object:cover',
      url: 'https://objects.test/upload',
      method: 'PUT' as const,
      headers: {},
      expiresAt: '2030-01-01T00:05:00.000Z',
      input,
    }));
    const authorize = vi.fn(async () => ({ url: 'https://objects.test/read', expiresAt: '2030-01-01T00:15:00.000Z' }));
    const assets = new RuntimeAssets({ authorizeUpload, authorize } as unknown as ObjectStore);

    const upload = await assets.authorize({ tenant: 'tenant:one', name: 'cover.png', contentType: 'image/png', size: 8, sha256: 'a'.repeat(64) });
    await expect(assets.link(upload.reference)).resolves.toEqual({ url: 'https://objects.test/read', expiresAt: '2030-01-01T00:15:00.000Z' });

    expect(upload.retentionUntil).toBeTruthy();
    expect(authorizeUpload).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('/asset/'), expiresIn: RUNTIME_LIMITS.upload.authorizationSeconds }));
    expect(authorize).toHaveBeenCalledExactlyOnceWith('object:cover', RUNTIME_LIMITS.upload.maximumAuthorizationSeconds);
  });
});
