import { createHash } from 'node:crypto';

export interface RegistrationMigrationExecution {
  readonly kind: 'original' | 'omitted' | 'transformed';
  readonly ledgerName: string;
  readonly ledgerStatements: readonly string[];
  readonly sql: string | null;
}

interface Transformation {
  readonly assertion: RegExp;
  readonly reason: string;
}

const PROFILE = 'registration-only/v1';
const HISTORY_HEAD = '20260820133000';
const OMITTED_MIGRATIONS = new Map<string, string>([
  ['20260817191000_bootstrap_ethan_platform_owner.sql', 'environment-specific Ethan platform owner fixture'],
  ['20260820132000_platform_owner_reconciliation.sql', 'environment-specific Ethan platform owner reconciliation'],
]);

const TRANSFORMATIONS = new Map<string, Transformation>([
  ['20260821066000_resolve_invitation_scope.sql', {
    assertion: /\ndo \$assert\$ begin\n  if access\.resource_scope\('identity\.invitations\.create',null,[\s\S]*?\nend \$assert\$;\n/,
    reason: 'assertion requires the omitted platform owner membership',
  }],
  ['20260821069000_add_store_management.sql', {
    assertion: /\n  select id into membership from access\.membership where client='operator' and status='active' order by id limit 1;\n  if access\.resource_scope\('organization\.stores\.manage','store:new',membership\) is null\n    then raise exception 'STORE_CREATE_SCOPE_UNRESOLVED'; end if;\n/,
    reason: 'store scope assertion requires the omitted platform owner membership',
  }],
  ['20260821074000_grant_platform_owner_operations.sql', {
    assertion: /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/,
    reason: 'grant assertion addresses the intentionally omitted platform owner',
  }],
  ['20260821075000_grant_platform_cardlibrary_read.sql', {
    assertion: /\ndo \$assert\$ begin[\s\S]*?\nend \$assert\$;\n/,
    reason: 'grant assertion addresses the intentionally omitted platform owner',
  }],
  ['20260821076000_grant_platform_cockpit_reads.sql', {
    assertion: /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/,
    reason: 'grant assertion addresses the intentionally omitted platform owner',
  }],
  ['20260821078000_complete_experience_application.sql', {
    assertion: /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/,
    reason: 'grant assertion addresses the intentionally omitted platform owner',
  }],
]);

export function registrationMigrationExecution(file: string, source: string): RegistrationMigrationExecution {
  const sourceDigest = sha256(source);
  const omissionReason = OMITTED_MIGRATIONS.get(file);
  if (omissionReason) {
    const executedDigest = sha256('');
    return Object.freeze({
      kind: 'omitted',
      ledgerName: `registration-omitted:${file}`,
      ledgerStatements: Object.freeze(metadata(sourceDigest, executedDigest, omissionReason)),
      sql: null,
    });
  }
  const transformation = TRANSFORMATIONS.get(file);
  if (!transformation) {
    const postHistory = file.slice(0, 14) > HISTORY_HEAD;
    return Object.freeze({
      kind: 'original',
      ledgerName: file,
      ledgerStatements: Object.freeze(postHistory
        ? metadata(sourceDigest, sourceDigest, 'append-only post-history migration executed byte-for-byte')
        : []),
      sql: source,
    });
  }
  const matches = source.match(new RegExp(transformation.assertion.source, 'g'));
  if (matches?.length !== 1) throw new Error(`REGISTRATION_MIGRATION_TRANSFORM_DRIFT:${file}`);
  const sql = source.replace(transformation.assertion, '\n');
  if (sql === source) throw new Error(`REGISTRATION_MIGRATION_TRANSFORM_EMPTY:${file}`);
  return Object.freeze({
    kind: 'transformed',
    ledgerName: `registration-transformed:${file}`,
    ledgerStatements: Object.freeze(metadata(sourceDigest, sha256(sql), transformation.reason)),
    sql,
  });
}

function metadata(sourceDigest: string, executedDigest: string, reason: string): string[] {
  return [
    `profile=${PROFILE}`,
    `source_sha256=${sourceDigest}`,
    `executed_sha256=${executedDigest}`,
    `reason=${reason}`,
  ];
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
