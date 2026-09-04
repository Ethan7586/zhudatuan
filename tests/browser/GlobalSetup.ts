import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LOCAL_API_ORIGIN } from '@shop/config/client';

const execute = promisify(execFile);

export default async function globalSetup(): Promise<void> {
  await command('database:replay');
  await command('local:migrate');
  await command('local:seed');
  await command('local:seed:visual');
  await command('local:seed:journey');
  const response = await fetch(`${LOCAL_API_ORIGIN}/health/ready`, { redirect: 'error' });
  if (!response.ok) throw new Error(`BROWSER_API_NOT_READY:${response.status}`);
  const body = (await response.json()) as Readonly<{ healthy?: boolean; condition?: string }>;
  if (body.healthy !== true || body.condition !== 'ready') throw new Error(`BROWSER_API_UNHEALTHY:${JSON.stringify(body)}`);
}

async function command(script: string): Promise<void> {
  const result = await execute('npm', ['run', script], { cwd: process.cwd(), maxBuffer: 16 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
