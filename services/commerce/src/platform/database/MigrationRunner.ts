import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { PoolClient } from 'pg';
import { MIGRATION_PHASES, TARGET_SCHEMA_HEAD, type MigrationPhase } from '@shop/config/server';

import type { KmsClient } from '../../pipeline/KmsPort';
import type { DatabasePool } from '../database/Pool';
import { OWNERSHIP_CUTOVER, ownerInheritanceSql } from './MigrationOwnership';
import { MigrationSecretStager, type MigrationSecrets } from './MigrationSecretStager';

export { ownerInheritanceSql } from './MigrationOwnership';

interface HistoryContract {
  readonly algorithm: 'sha256';
  readonly count: number;
  readonly head: string;
  readonly migrations: readonly { readonly file: string; readonly sha256: string }[];
}

const BACKFILL = '20260821026000_backfill_domain_data.sql';
export class MigrationRunner {
  private readonly secretStager: MigrationSecretStager;

  constructor(
    private readonly pool: DatabasePool,
    kms: KmsClient,
    private readonly directory: string,
    secrets: MigrationSecrets
  ) {
    this.secretStager = new MigrationSecretStager(kms, secrets);
  }

  async run(phase: MigrationPhase): Promise<void> {
    const client = await this.pool.connect();
    let ownerInheritanceEnabled = false;
    try {
      await this.assertRoleCanBeSet(client);
      await client.query('set role shopmigration');
      await this.assertRole(client);
      await client.query("select pg_advisory_lock(hashtext('shop-domain-hard-cut'))");
      const files = (await readdir(this.directory)).filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
      const historyHead = await this.assertHistory(files);
      const applied = await this.applied(client, files);
      for (const file of migrationsForPhase(files, historyHead, phase, applied)) {
        const version = file.slice(0, 14);
        if (!ownerInheritanceEnabled && file >= OWNERSHIP_CUTOVER) {
          await this.setOwnerInheritance(client, true);
          ownerInheritanceEnabled = true;
        }
        if (file === BACKFILL) await this.secretStager.stage(client);
        const sql = await readFile(join(this.directory, file), 'utf8');
        try {
          await client.query(sql);
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
          throw error;
        }
        await client.query('insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)', [version, [], file]);
        applied.add(version);
      }
      if (phase === 'retire') {
        const missing = files.find((file) => !applied.has(file.slice(0, 14)));
        if (missing !== undefined) throw new Error(`MIGRATION_PHASE_INCOMPLETE:${phase}:${missing}`);
        if (ownerInheritanceEnabled) {
          await this.setOwnerInheritance(client, false);
          ownerInheritanceEnabled = false;
        }
        await client.query('reset role');
        await client.query('set role shopmigration');
        await this.assertFinalRole(client);
        const result = await client.query<{ readonly valid: boolean }>(`select exists(select 1 from runtime.schemaversion where version=$1) and not exists(select 1 from pg_tables where schemaname='public') valid`, [TARGET_SCHEMA_HEAD]);
        if (result.rows[0]?.valid !== true) throw new Error('MIGRATION_TARGET_INVALID');
      }
    } finally {
      if (ownerInheritanceEnabled) {
        await client.query('rollback').catch(() => undefined);
        await this.setOwnerInheritance(client, false).catch(() => undefined);
      }
      await client.query("select pg_advisory_unlock(hashtext('shop-domain-hard-cut'))").catch(() => undefined);
      await client.query('reset role').catch(() => undefined);
      client.release();
    }
  }

  private async setOwnerInheritance(client: PoolClient, enabled: boolean): Promise<void> {
    await client.query('reset role');
    await client.query(ownerInheritanceSql(enabled));
    await client.query('set role shopmigration');
  }

  private async assertRoleCanBeSet(client: PoolClient): Promise<void> {
    const result = await client.query<{ readonly allowed: boolean }>(`select pg_has_role(session_user,'shopmigration','set') allowed`);
    if (result.rows[0]?.allowed !== true) throw new Error('MIGRATION_ROLE_SET_FORBIDDEN');
  }

  private async assertRole(client: PoolClient): Promise<void> {
    const result = await client.query<{ readonly active: boolean; readonly allowed: boolean; readonly safe: boolean }>(
      `select current_user='shopmigration' active,
        pg_has_role(session_user,'shopmigration','member') allowed,
        exists(select 1 from pg_roles where rolname=current_user and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls) safe`
    );
    if (result.rows[0]?.active !== true || result.rows[0].allowed !== true || result.rows[0].safe !== true) throw new Error('MIGRATION_ROLE_INVALID');
  }

  private async assertFinalRole(client: PoolClient): Promise<void> {
    const result = await client.query<{ readonly valid: boolean }>(
      `select exists(select 1 from pg_roles where rolname=current_user and rolname='shopmigration' and not rolcanlogin and not rolinherit
        and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls)
        and not exists(
          select 1 from pg_auth_members membership
          join pg_roles member_role on member_role.oid=membership.member
          join pg_roles owner_role on owner_role.oid=membership.roleid
          where member_role.rolname='shopmigration' and owner_role.rolname~'^shop[a-z]+owner$' and membership.inherit_option
        ) valid`
    );
    if (result.rows[0]?.valid !== true) throw new Error('MIGRATION_ROLE_FINAL_STATE_INVALID');
  }

  private async assertHistory(files: readonly string[]): Promise<string> {
    const contract = JSON.parse(await readFile(join(this.directory, '..', 'contracts', 'history.json'), 'utf8')) as HistoryContract;
    if (contract.algorithm !== 'sha256' || contract.count !== contract.migrations.length || contract.count < 1 || contract.migrations.at(-1)?.file.slice(0, 14) !== contract.head) throw new Error('MIGRATION_HISTORY_CONTRACT_INVALID');
    const historical = files.filter((file) => file.slice(0, 14) <= contract.head);
    if (historical.join('\n') !== contract.migrations.map((migration) => migration.file).join('\n')) throw new Error('MIGRATION_HISTORY_FILESET_DRIFT');
    for (const migration of contract.migrations) {
      const digest = createHash('sha256')
        .update(await readFile(join(this.directory, migration.file)))
        .digest('hex');
      if (digest !== migration.sha256) throw new Error(`MIGRATION_HISTORY_HASH_DRIFT:${basename(migration.file)}`);
    }
    return contract.head;
  }

  private async applied(client: PoolClient, files: readonly string[]): Promise<Set<string>> {
    const result = await client.query<{ readonly name: string; readonly version: string }>('select version,name from supabase_migrations.schema_migrations');
    assertAppliedMigrationIdentities(files, result.rows);
    return new Set(result.rows.map((row) => row.version));
  }
}

export function assertAppliedMigrationIdentities(files: readonly string[], applied: readonly { readonly name: string; readonly version: string }[]): void {
  const expected = new Map(files.map((file) => [file.slice(0, 14), file]));
  for (const migration of applied) {
    const file = expected.get(migration.version);
    if (file !== undefined && migration.name !== file) {
      throw new Error(`MIGRATION_APPLIED_IDENTITY_DRIFT:${migration.version}`);
    }
  }
}

export function phaseOfMigration(file: string, historyHead: string): MigrationPhase {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file) || !/^\d{14}$/.test(historyHead)) throw new Error('MIGRATION_FILE_INVALID');
  if (file.slice(0, 14) <= historyHead) return 'prepare';
  if (file.includes('_backfill_')) return 'backfill';
  if (file.includes('_assert_')) return 'assert';
  if (file.includes('_publish_')) return 'cutover';
  if (file.includes('_retire_') || file.includes('_finalize_')) return 'retire';
  return 'prepare';
}

export function migrationsForPhase(files: readonly string[], historyHead: string, phase: MigrationPhase, applied: ReadonlySet<string>): readonly string[] {
  const firstPending = files.findIndex((file) => !applied.has(file.slice(0, 14)));
  if (firstPending < 0) return [];
  const appliedAfterGap = files.slice(firstPending + 1).find((file) => applied.has(file.slice(0, 14)));
  if (appliedAfterGap !== undefined) throw new Error(`MIGRATION_SEQUENCE_GAP:${files[firstPending]}`);
  const ceiling = MIGRATION_PHASES.indexOf(phase);
  const selected: string[] = [];
  for (const file of files.slice(firstPending)) {
    if (MIGRATION_PHASES.indexOf(phaseOfMigration(file, historyHead)) > ceiling) break;
    selected.push(file);
  }
  return selected;
}
