#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const outputs = [
  'docs/requirements/source.yml',
  'docs/requirements/requirements.yml',
  'docs/requirements/mvp.yml',
  'docs/requirements/providers.yml',
  'docs/requirements/frontend.yml',
  'docs/requirements/trace.yml',
  'docs/requirements/mapping.json',
  'config/providers.yml',
  'packages/contract/openapi.json',
  'packages/contract/events.json',
  'packages/contract/src/ContractIdentity.ts',
  'packages/contract/src/RequirementCatalog.ts',
  'packages/config/src/RouteCatalog.ts',
  'apps/auth/src/generated/RouteBinding.ts',
  'apps/auth/src/generated/NavigationBinding.ts',
  'apps/console/src/generated/NavigationBinding.ts',
  'apps/console/src/generated/RouteBinding.ts',
  'apps/storefront/src/generated/RouteBinding.ts',
  'apps/storefront/src/generated/NavigationBinding.ts',
  'apps/miniapp/miniprogram/generated/NavigationBinding.ts',
  'apps/miniapp/miniprogram/generated/PageBinding.ts',
  'apps/miniapp/miniprogram/generated/RouteBinding.ts',
  'apps/miniapp/miniprogram/app.json',
  'apps/miniapp/miniprogram/styles/tokens.wxss',
  'apps/miniapp/miniprogram/assets/brandmark.svg',
  'apps/miniapp/miniprogram/assets/wingcode.svg',
  'apps/store/src/generated/NavigationBinding.ts',
  'apps/store/src/generated/RouteBinding.ts',
  'apps/supplier/src/generated/NavigationBinding.ts',
  'apps/supplier/src/generated/RouteBinding.ts',
  'services/commerce/src/modules/extension/infrastructure/loader/ProviderCatalog.ts',
  'services/commerce/src/modules/navigation/infrastructure/registry/NavigationCatalog.ts',
  'evidence/navigation/catalog.json',
  'evidence/releases/index.json',
  'database/contracts/current.sql',
];

generate();
const first = fingerprint();
generate();
const second = fingerprint();
if (first !== second) throw new Error('GENERATION_NOT_DETERMINISTIC');
process.stdout.write(`generation accepted: outputs=${outputs.length} deterministic=true\n`);

function generate() {
  const result = spawnSync('npm', ['run', 'generate'], { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

function fingerprint() {
  const hash = createHash('sha256');
  for (const file of outputs)
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(resolve(repositoryRoot, file)))
      .update('\0');
  return hash.digest('hex');
}
