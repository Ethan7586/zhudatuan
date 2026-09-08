import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');

export async function audit(script: string, ...arguments_: readonly string[]): Promise<string> {
  const { stdout, stderr } = await execute(process.execPath, [script, ...arguments_], {
    cwd: root,
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return `${stdout}${stderr}`;
}
