import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SecretCatalog } from './SecretCatalog';

test('loads only named string secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-secrets-'));
  const file = join(directory, 'secrets.json');
  await writeFile(file, JSON.stringify({ 'database/api': 'postgres://local' }));
  const catalog = await SecretCatalog.load(file);
  assert.equal(catalog.get('database/api'), 'postgres://local');
  assert.equal(catalog.get('../database/api'), undefined);
});

test('rejects non-string values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-secrets-'));
  const file = join(directory, 'secrets.json');
  await writeFile(file, JSON.stringify({ 'database/api': 1 }));
  await assert.rejects(SecretCatalog.load(file), /LOCAL_SECRETS_INVALID/);
});
