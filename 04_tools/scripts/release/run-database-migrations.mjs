#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [releaseDirectory, sourceSha] = process.argv.slice(2);
if (!releaseDirectory) throw new Error('MIGRATION_RELEASE_DIRECTORY_REQUIRED');
if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '')) throw new Error('MIGRATION_SOURCE_SHA_INVALID');

const directory = resolve(releaseDirectory);
const runner = resolve(directory, 'executor/DatabaseMigrationExecutor.js');
const migrationDirectory = resolve(directory, 'database/supabase/migrations');
const runtimeUser = 'zhudatuan';
const uid = Number(execFileSync('id', ['-u', runtimeUser], { encoding: 'utf8' }).trim());
const gid = Number(execFileSync('id', ['-g', runtimeUser], { encoding: 'utf8' }).trim());
const migrationEnvironment = parseEnvironment(await readFile('/opt/zhudatuan/shared/migration.env', 'utf8'));
const databaseEnvironment = parseEnvironment(await readFile('/opt/zhudatuan/shared/postgres.env', 'utf8'));

const exitCode = await new Promise((resolveExit, rejectExit) => {
  const child = spawn('/usr/bin/node', [runner], {
    cwd: directory,
    uid,
    gid,
    stdio: 'inherit',
    env: {
      PATH: process.env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      NODE_ENV: 'production',
      APP_ENV: 'production',
      ...migrationEnvironment,
      ...databaseEnvironment,
      REGISTRATION_MIGRATION_PROFILE: 'registration-only',
      MIGRATION_DIRECTORY: migrationDirectory,
      AI_DELIVERY_SOURCE_SHA: sourceSha,
      DATABASE_MIGRATION_EXECUTION_MODE: 'database-owner',
      MIGRATION_OWNER_DATABASE_HOST: '127.0.0.1',
      MIGRATION_OWNER_DATABASE_PORT: '55432',
    },
  });
  child.once('error', rejectExit);
  child.once('exit', (code, signal) => {
    if (signal) process.stderr.write(`Migration executor stopped by ${signal}\n`);
    resolveExit(code ?? 1);
  });
});
if (exitCode !== 0) process.exitCode = exitCode;

function parseEnvironment(source) {
  const result = {};
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) throw new Error('MIGRATION_ENVIRONMENT_LINE_INVALID');
    const value = match[2].trim();
    result[match[1]] = ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) ? value.slice(1, -1) : value;
  }
  return result;
}
