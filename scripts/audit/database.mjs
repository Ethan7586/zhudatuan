import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { root } from '../check/source.mjs';

const result = spawnSync(process.execPath, [join(root, 'scripts/audit/database-contracts.mjs'), '--schema-fresh'], { cwd: root, encoding: 'utf8' });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if (result.status !== 0) process.exitCode = result.status ?? 1;

