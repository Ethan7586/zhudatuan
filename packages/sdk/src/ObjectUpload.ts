export interface ObjectUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Blob;
  readonly signal?: AbortSignal;
}

export async function uploadObject(input: ObjectUpload, fetcher: typeof fetch = fetch): Promise<void> {
  const target = new URL(input.url);
  const local = target.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
  if (target.username || target.password || target.hash || (target.protocol !== 'https:' && !local)) throw new Error('SDK_OBJECT_UPLOAD_URL_INVALID');
  const response = await fetcher(target, {
    method: 'PUT',
    headers: new Headers(input.headers),
    body: input.body,
    credentials: 'omit',
    redirect: 'error',
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  if (!response.ok) throw new Error('SDK_OBJECT_UPLOAD_FAILED');
}
