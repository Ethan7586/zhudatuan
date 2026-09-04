import { describe, expect, it, vi } from 'vitest';
import { uploadObject } from './ObjectUpload';

describe('signed object upload', () => {
  it('uploads without ambient credentials or redirect forwarding', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    await uploadObject({ url: 'https://objects.example.test/upload?signature=opaque', headers: { 'content-type': 'text/plain' }, body: new Blob(['safe']) }, fetcher);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'PUT', credentials: 'omit', redirect: 'error' }));
  });

  it('rejects insecure non-loopback destinations and failed writes', async () => {
    await expect(uploadObject({ url: 'http://objects.example.test/upload', headers: {}, body: new Blob() }, vi.fn())).rejects.toThrow('SDK_OBJECT_UPLOAD_URL_INVALID');
    await expect(uploadObject({ url: 'https://objects.example.test/upload', headers: {}, body: new Blob() }, vi.fn(() => Promise.resolve(new Response(null, { status: 403 }))))).rejects.toThrow('SDK_OBJECT_UPLOAD_FAILED');
  });
});
