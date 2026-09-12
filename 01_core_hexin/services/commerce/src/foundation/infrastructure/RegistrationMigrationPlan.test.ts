import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  registrationMigrationExecution,
  registrationMigrationLedgerMatches,
  registrationMigrationTarget,
} from './RegistrationMigrationPlan';

const migration = (file: string) => fileURLToPath(new URL(`../../../../../../02_platform_pingtai/database/supabase/migrations/${file}`, import.meta.url));

describe('registration migration execution plan', () => {
  it.each([
    '20260817191000_bootstrap_ethan_platform_owner.sql',
    '20260820132000_platform_owner_reconciliation.sql',
  ])('records an explicit source and empty-execution hash for omitted environment migration %s', async (file) => {
    const execution = registrationMigrationExecution(file, await readFile(migration(file), 'utf8'));
    expect(execution.kind).toBe('omitted');
    expect(execution.sql).toBeNull();
    expect(execution.ledgerName).toBe(`registration-omitted:${file}`);
    expect(execution.ledgerStatements).toEqual([
      'profile=registration-only/v1',
      expect.stringMatching(/^source_sha256=[a-f0-9]{64}$/),
      'executed_sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      expect.stringMatching(/^reason=environment-specific Ethan platform owner/),
    ]);
  });

  it.each([
    '20260829060000_zhudatuan_operator_invitation_registration.sql',
    '20260829210000_owner_operator_coverage.sql',
    '20260829211000_platform_owner_transfer.sql',
    '20260829212000_owner_runtime_boundary_hardening.sql',
    '20260829213000_reconcile_contract_identity_checksum.sql',
    '20260829214000_owner_personal_scope_and_invoice_scope.sql',
    '20260829215000_restore_invoice_request_operator_boundary.sql',
    '20260829216000_owner_capability_exactness.sql',
    '20260829217000_scope_hint_resource_precedence.sql',
    '20260821066000_resolve_invitation_scope.sql',
    '20260821069000_add_store_management.sql',
    '20260821074000_grant_platform_owner_operations.sql',
    '20260821075000_grant_platform_cardlibrary_read.sql',
    '20260821076000_grant_platform_cockpit_reads.sql',
    '20260821078000_complete_experience_application.sql',
  ])('records source and executed hashes for transformed assertion migration %s', async (file) => {
    const source = await readFile(migration(file), 'utf8');
    const execution = registrationMigrationExecution(file, source);
    expect(execution.kind).toBe('transformed');
    expect(execution.sql).not.toBe(source);
    expect(execution.ledgerName).toBe(`registration-transformed:${file}`);
    expect(execution.ledgerStatements).toEqual([
      'profile=registration-only/v1',
      expect.stringMatching(/^source_sha256=[a-f0-9]{64}$/),
      expect.stringMatching(/^executed_sha256=[a-f0-9]{64}$/),
      expect.stringMatching(/^reason=/),
    ]);
    expect(execution.ledgerStatements[1]).not.toBe(execution.ledgerStatements[2]);
    if (file >= '20260829060000') {
      expect(execution.sql).not.toContain('FUTURE_HEAD_INVALID');
      expect(execution.sql).toContain('PREDECESSOR_INVALID');
    }
  });

  it('fails closed when a known source assertion drifts', () => {
    expect(() => registrationMigrationExecution('20260821066000_resolve_invitation_scope.sql', 'begin; commit;'))
      .toThrow('REGISTRATION_MIGRATION_TRANSFORM_DRIFT:20260821066000_resolve_invitation_scope.sql');
  });

  it('records matching source and executed hashes for post-history migrations executed byte-for-byte', () => {
    const source = 'begin; select 1; commit;';
    const execution = registrationMigrationExecution('20260828170000_zhudatuan_registration_baseline.sql', source);
    expect(execution).toEqual({
      kind: 'original',
      ledgerName: '20260828170000_zhudatuan_registration_baseline.sql',
      ledgerStatements: [
        'profile=registration-only/v1',
        expect.stringMatching(/^source_sha256=[a-f0-9]{64}$/),
        expect.stringMatching(/^executed_sha256=[a-f0-9]{64}$/),
        'reason=append-only post-history migration executed byte-for-byte',
      ],
      sql: source,
    });
    expect(execution.ledgerStatements[1]?.replace('source_', '')).toBe(execution.ledgerStatements[2]?.replace('executed_', ''));
  });

  it.each([
    ['20260821024000_create_reporting_risk_audit.sql', '00183e44ff0a117d39517c817e9e1026d7082ea6299045d03dd8e0ca30e8c319'],
    ['20260901210000_restore_platform_owner_personal_scope_projection.sql', 'a495fc44da027afcecb41909a7de00fe60089afec62ca44ddf701478ee6484f6'],
    ['20260901220000_add_payment_mall_identity.sql', '1e7a0b0841a37bd3723ddc3bac4230c2e3882366f34f71d1fe144b4aa8067ee9'],
    ['20260901221000_add_fulfillment_mall_identity.sql', '41c73d6cb3b2fc92f9bcb2251be31fbbca0658a233b9d24c13db95fc79b80ef2'],
    ['20260901222000_add_inventory_mall_identity.sql', 'de979916659055a7880c8c5abb361ba196a7a113446ea2d464d9bb43e001d563'],
    ['20260901223000_publish_mall_provisioning.sql', '0fc9672ada080c8936a0122d2fa1a9ed1d1b5bcd7a241955da38e6cb1795434c'],
    ['20260902010000_restore_public_mall_role_contracts.sql', 'b940b13ee960dd4468436f14a0a04a896e0df18b18bf066ef74cf784e5e3c276'],
  ])('keeps restored production ledger source %s byte-for-byte', async (file, sourceDigest) => {
    const execution = registrationMigrationExecution(file, await readFile(migration(file), 'utf8'));
    expect(execution.kind).toBe('original');
    expect(execution.ledgerStatements).toEqual([
      'profile=registration-only/v1',
      `source_sha256=${sourceDigest}`,
      `executed_sha256=${sourceDigest}`,
      'reason=append-only post-history migration executed byte-for-byte',
    ]);
  });

  it('keeps immutable historical originals in their legacy empty-statement ledger shape', () => {
    const source = 'begin; select 1; commit;';
    expect(registrationMigrationExecution('20260820133000_inventory_single_source_cutover.sql', source)).toEqual({
      kind: 'original', ledgerName: '20260820133000_inventory_single_source_cutover.sql', ledgerStatements: [], sql: source,
    });
  });

  it.each([
    ['20260831150000_identity_experience_application_commands.sql', '4810ba8bc5cb49b67a648e788f70f5c0cc2b10910fb3d168a797a37806b0e3c7'],
    ['20260905010000_publish_runtime_catalog_alignment.sql', '8a463fab4e676ada72750ff449e66971e9ef095db64a1f7e23ba2d27002f739d'],
    ['20260905011000_expand_governance_store_scope.sql', 'ce286f1fbc37b2804cae61418ff9fb7854fc0b0688c847429cc62f840d179e0b'],
    ['20260905012000_honor_invitation_scope_hint.sql', '0dc53b18e12bd5a1478d339c21314a7d6a6db2c64e2a68172f47f716e5880860'],
    ['20260905013000_registration_invite_role_projection.sql', 'ab03873df52391ea3abb2b2376705166b9742471d3087a09bd144a6d2ec852d7'],
    ['20260905014000_bind_storefront_browse_scope.sql', '591b42a51455418e8c9224972453fc05e523fde7132e565aedfca4fe03a0dacf'],
    ['20260905203000_provision_zhudatuan_storefront_application.sql', 'eccaa52b4f52f7f66d6c5f64a7e8ad9541bd1781dcae55f176e2214e19af3da6'],
    ['20260909010000_bind_published_listings_to_storefront_pool.sql', 'e879110631a0dd4323218743c392240a398bb4f235d5972313d8d00eabf5b08b'],
    ['20260909061000_add_checkout_address_default.sql', '5caaab79f8e3159cfe410bde4a1dc86b9d355380ee5afb7fe64971ec4ea28f75'],
    ['20260912182000_create_storefront_member_node_projection.sql', '428c379ced8eb5396e28812be98acab2818433ce718bd29a99cbf8050b7892ea'],
    ['20260912183000_fix_storefront_member_node_projection.sql', 'f1504e5317bf77c4dcc47980533743469d7176a1a034a66e01e2e68322909206'],
  ])('accepts legacy generic ledger row %s only for its immutable source', async (file, sourceDigest) => {
    const source = await readFile(migration(file), 'utf8');
    const execution = registrationMigrationExecution(file, source);
    expect(execution.ledgerStatements[1]).toBe(`source_sha256=${sourceDigest}`);
    expect(registrationMigrationLedgerMatches(file, execution.ledgerName, [], execution)).toBe(true);
    const drifted = registrationMigrationExecution(file, `${source}\n-- drift`);
    expect(registrationMigrationLedgerMatches(file, drifted.ledgerName, [], drifted)).toBe(false);
    expect(registrationMigrationLedgerMatches(file, 'wrong-name.sql', [], execution)).toBe(false);
  });

  it('rejects an unlisted empty-statement ledger row', () => {
    const file = '20260831140000_identity_registration_profile_acl_repair.sql';
    const execution = registrationMigrationExecution(file, 'begin; select 1; commit;');
    expect(registrationMigrationLedgerMatches(file, execution.ledgerName, [], execution)).toBe(false);
  });

  it('accepts only the exact transparent identity runtime reconciliation record', async () => {
    const file = '20260912030000_create_sfl_multi_realm_membership.sql';
    const execution = registrationMigrationExecution(file, await readFile(migration(file), 'utf8'));
    const statements = [
      'profile=registration-reconciled/v1',
      'source_sha256=031939070132c1af56a8bd4c55797d49079399b61fdba86d0ff2a741a8b47366',
      'repair=20260912180000_reconcile_identity_runtime_state.sql',
      'reason=production runtime objects reconciled from verified existing state',
    ];
    expect(registrationMigrationLedgerMatches(file, `registration-reconciled:${file}`, statements, execution)).toBe(true);
    expect(registrationMigrationLedgerMatches(file, `registration-reconciled:${file}`, [...statements, 'drift'], execution)).toBe(false);
  });

  it('derives the registration target from the latest migration runtime marker', async () => {
    const file = '20260912250000_grant_catalog_media_replication_job.sql';
    const source = await readFile(migration(file), 'utf8');
    expect(registrationMigrationTarget(file, source)).toEqual({
      checksum: '24f71fb162010ad5da92d48532535e387f7b49cef24130835a86ea0e50997f5a',
      file,
      version: '20260912250000',
    });
  });

  it('rejects a latest migration without one matching runtime marker', () => {
    expect(() => registrationMigrationTarget('20260912260000_missing.sql', 'begin; commit;'))
      .toThrow('REGISTRATION_MIGRATION_TARGET_MARKER_INVALID:20260912260000_missing.sql');
  });
});
