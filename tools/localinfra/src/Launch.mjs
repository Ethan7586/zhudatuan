import { spawn } from 'node:child_process';

const arguments_ = process.argv.slice(2);
if (arguments_.length === 0) throw new Error('LOCAL_LAUNCH_ARGUMENTS_MISSING');
const child = spawn(process.execPath, arguments_, { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', (cause) => {
  throw cause;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
