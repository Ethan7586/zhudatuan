import { hostname } from 'node:os';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { DeliveryError } from './errors.mjs';

export async function acquireLocks(lockDirectories, metadata = {}) {
  const acquired = [];
  try {
    for (const directory of [...new Set(lockDirectories)].sort()) {
      await mkdir(dirname(directory), { recursive: true });
      try {
        await mkdir(directory);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const owner = await readOwner(directory);
        if (owner.host === hostname() && Number.isInteger(owner.pid) && !isAlive(owner.pid)) {
          await rm(directory, { recursive: true, force: true });
          await mkdir(directory);
        } else {
          throw new DeliveryError('DELIVERY_LOCKED', `Release target is already locked: ${directory}`, { directory, owner });
        }
      }
      const owner = {
        schema: 'ai.delivery.lock.v1',
        pid: process.pid,
        host: hostname(),
        publisher: process.env.AI_DELIVERY_ACTOR ?? process.env.USER ?? 'unknown',
        startedAt: new Date().toISOString(),
        ...metadata,
      };
      await writeFile(join(directory, 'owner.json'), `${JSON.stringify(owner, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      acquired.push(directory);
    }
  } catch (error) {
    await releaseLocks(acquired);
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await releaseLocks(acquired);
  };
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function releaseLocks(lockDirectories) {
  for (const directory of [...lockDirectories].reverse()) await rm(directory, { recursive: true, force: true });
}

async function readOwner(directory) {
  try {
    return JSON.parse(await readFile(join(directory, 'owner.json'), 'utf8'));
  } catch {
    return { status: 'owner metadata unavailable' };
  }
}
