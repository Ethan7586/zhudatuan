import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { moduleDatabaseRoles } from './DatabaseRoles';

const contract = await readFile(new URL('../../../database/contracts/objects.yml', import.meta.url), 'utf8');
const roles = moduleDatabaseRoles(contract).join(' ');
const compose = ['compose', '--env-file', 'infrastructure/container/local/.env.local', '-f', 'infrastructure/container/local/compose.yml', 'exec', '-T', '-e', `MODULE_DATABASE_ROLES=${roles}`, 'postgres', 'sh', '-s'];

async function bootstrapDatabase(): Promise<void> {
  const script = await readFile(new URL('../../../infrastructure/container/local/Postgres.sh', import.meta.url), 'utf8');
  const process = spawn('docker', compose, { stdio: ['pipe', 'inherit', 'inherit'] });
  process.stdin.end(script);
  const code = await new Promise<number | null>((resolve, reject) => {
    process.once('error', reject);
    process.once('exit', resolve);
  });
  if (code !== 0) {
    throw new Error(`POSTGRES_BOOTSTRAP_EXIT_${code ?? 'SIGNAL'}`);
  }
}

await bootstrapDatabase();
