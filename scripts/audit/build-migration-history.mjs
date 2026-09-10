import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const directory = join(repositoryRoot, 'database', 'migrations');
const head = '20260903116000';
const files = (await readdir(directory)).filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file) && file.slice(0, 14) <= head).sort();
const migrations = await Promise.all(
  files.map(async (file) =>
    Object.freeze({
      file,
      sha256: createHash('sha256')
        .update(await readFile(join(directory, file)))
        .digest('hex'),
    })
  )
);
if (migrations.length !== 318 || migrations.at(-1)?.file.slice(0, 14) !== head) throw new Error('CANONICAL_MIGRATION_BASELINE_INVALID');
await writeFile(
  join(repositoryRoot, 'database', 'contracts', 'history.json'),
  `${JSON.stringify(
    {
      algorithm: 'sha256',
      count: migrations.length,
      head,
      migrations,
    },
    null,
    2
  )}\n`
);
