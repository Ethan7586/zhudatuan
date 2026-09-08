import { spawn } from 'node:child_process';

export async function run(command: string, arguments_: readonly string[], environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: process.cwd(), env: environment, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0 ? resolve() : reject(new Error(`LOCAL_PROCESS_FAILED:${code ?? signal ?? 'unknown'}`))));
  });
}
