export interface ObjectUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Blob;
  readonly signal?: AbortSignal;
  readonly progress?: (uploaded: number, total: number) => void;
}

export async function uploadObject(input: ObjectUpload, fetcher: typeof fetch = fetch): Promise<void> {
  const target = new URL(input.url);
  const local = target.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
  if (target.username || target.password || target.hash || (target.protocol !== 'https:' && !local)) throw new Error('SDK_OBJECT_UPLOAD_URL_INVALID');
  if (input.progress !== undefined && typeof XMLHttpRequest !== 'undefined') return xhrUpload(target, input);
  const response = await fetcher(target, {
    method: 'PUT',
    headers: new Headers(browserHeaders(input.headers)),
    body: input.body,
    credentials: 'omit',
    redirect: 'error',
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  if (!response.ok) throw new Error('SDK_OBJECT_UPLOAD_FAILED');
}

function xhrUpload(target: URL, input: ObjectUpload): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = (action: () => void) => {
      input.signal?.removeEventListener('abort', abort);
      action();
    };
    request.open('PUT', target.toString(), true);
    request.withCredentials = false;
    for (const [name, value] of browserHeaders(input.headers)) request.setRequestHeader(name, value);
    request.upload.addEventListener('progress', (event) => input.progress?.(event.loaded, event.lengthComputable ? event.total : input.body.size));
    request.addEventListener('load', () => finish(() => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('SDK_OBJECT_UPLOAD_FAILED')))));
    request.addEventListener('error', () => finish(() => reject(new Error('SDK_OBJECT_UPLOAD_FAILED'))));
    request.addEventListener('abort', () => finish(() => reject(input.signal?.reason ?? new Error('SDK_OBJECT_UPLOAD_ABORTED'))));
    if (input.signal?.aborted) return abort();
    input.signal?.addEventListener('abort', abort, { once: true });
    request.send(input.body);
  });
}

function browserHeaders(headers: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'content-length');
}
