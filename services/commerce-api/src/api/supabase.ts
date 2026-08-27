import type { WorkerEnv } from './types';

const MAX_ERROR_BODY = 2_000;

export function isSupabaseConfigured(env: WorkerEnv): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function callRpc<T>(env: WorkerEnv, functionName: string, parameters: Record<string, unknown> = {}): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(parameters),
  });

  if (!response.ok) {
    const detail = await readLimitedText(response, MAX_ERROR_BODY);
    throw new Error(`SUPABASE_RPC_FAILED:${functionName}:${response.status}:${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readLimitedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let output = '';
  try {
    while (received < maximumBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maximumBytes - received;
      const chunk = value.subarray(0, remaining);
      output += decoder.decode(chunk, { stream: true });
      received += chunk.byteLength;
      if (value.byteLength > remaining) break;
    }
    output += decoder.decode();
    return output;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
