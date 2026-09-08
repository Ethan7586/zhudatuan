import { LOCAL_API_ORIGIN } from '@shop/config/client';

export default async function globalSetup(): Promise<void> {
  const response = await fetch(`${LOCAL_API_ORIGIN}/health/ready`, { redirect: 'error' });
  if (!response.ok) throw new Error(`BROWSER_API_NOT_READY:${response.status}`);
  const body = (await response.json()) as Readonly<{ healthy?: boolean; condition?: string }>;
  if (body.healthy !== true || body.condition !== 'ready') throw new Error(`BROWSER_API_UNHEALTHY:${JSON.stringify(body)}`);
}
