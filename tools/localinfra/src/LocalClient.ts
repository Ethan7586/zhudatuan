export async function localFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, redirect: 'error' });
}

export async function localJson(input: string | URL, init?: RequestInit): Promise<Readonly<Record<string, unknown>>> {
  const response = await localFetch(input, init);
  if (!response.ok) throw new Error(`LOCAL_HTTP_${response.status}`);
  const value: unknown = await response.json();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('LOCAL_HTTP_JSON_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

export async function localSecret(endpoint: string, bearerToken: string, reference: string): Promise<string> {
  if (!endpoint.startsWith('https://') || !/^[A-Za-z0-9_-]{43,512}$/.test(bearerToken) || bearerToken.length % 4 === 1
    || !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(reference)) throw new Error('LOCAL_SECRET_REQUEST_INVALID');
  const value = await localJson(`${endpoint.replace(/\/$/, '')}/v1/secrets/${encodeURIComponent(reference)}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${bearerToken}` },
  });
  if (typeof value.value !== 'string' || value.value.length === 0) throw new Error('LOCAL_SECRET_VALUE_INVALID');
  return value.value;
}
