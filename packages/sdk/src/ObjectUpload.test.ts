import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadObject } from './ObjectUpload';

afterEach(() => vi.unstubAllGlobals());

describe('signed object upload', () => {
  it('uploads without ambient credentials or redirect forwarding', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    await uploadObject({ url: 'https://objects.example.test/upload?signature=opaque', headers: { 'content-type': 'text/plain' }, body: new Blob(['safe']) }, fetcher);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'PUT', credentials: 'omit', redirect: 'error' }));
  });

  it('rejects insecure non-loopback destinations and failed writes', async () => {
    await expect(uploadObject({ url: 'http://objects.example.test/upload', headers: {}, body: new Blob() }, vi.fn())).rejects.toThrow('SDK_OBJECT_UPLOAD_URL_INVALID');
    await expect(
      uploadObject(
        { url: 'https://objects.example.test/upload', headers: {}, body: new Blob() },
        vi.fn(() => Promise.resolve(new Response(null, { status: 403 })))
      )
    ).rejects.toThrow('SDK_OBJECT_UPLOAD_FAILED');
  });

  it('reports actual browser upload bytes when progress is requested', async () => {
    const progress = vi.fn();
    const fetcher = vi.fn();
    vi.stubGlobal('XMLHttpRequest', FakeRequest);

    await uploadObject({ url: 'https://objects.example.test/upload?signature=opaque', headers: { 'content-type': 'image/png', 'content-length': '4' }, body: new Blob(['safe']), progress }, fetcher);

    expect(progress).toHaveBeenCalledWith(4, 4);
    expect(fetcher).not.toHaveBeenCalled();
    expect(FakeRequest.last?.headers).toEqual({ 'content-type': 'image/png' });
    expect(FakeRequest.last?.withCredentials).toBe(false);
  });
});

class FakeRequest {
  static last: FakeRequest | undefined;
  readonly headers: Record<string, string> = {};
  readonly upload = { addEventListener: (_name: string, listener: (event: ProgressEvent) => void) => (this.progress = listener) };
  status = 204;
  withCredentials = true;
  private progress: ((event: ProgressEvent) => void) | undefined;
  private readonly listeners = new Map<string, () => void>();

  constructor() {
    FakeRequest.last = this;
  }

  open() {}
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener);
  }
  send(body: Blob) {
    this.progress?.({ loaded: body.size, total: body.size, lengthComputable: true } as ProgressEvent);
    this.listeners.get('load')?.();
  }
  abort() {
    this.listeners.get('abort')?.();
  }
}
