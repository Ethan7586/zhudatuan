import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrations = fileURLToPath(new URL('../../../../database/supabase/migrations', import.meta.url));
const scope = 'organization-platform-root';
const alternateScope = 'mall-demo';

interface Actor {
  readonly actor: string;
  readonly membership: string;
  readonly session: string;
  readonly assurance: string;
}

const proposer: Actor = Object.freeze({
  actor: 'principal:zhudatuan:owner:ethan:v1',
  membership: 'membership-platform-owner-ethan-v1',
  session: 'session:policy:proposer',
  assurance: 'assurance:policy:proposer',
});
const reviewer: Actor = Object.freeze({
  actor: 'principal:policy:reviewer',
  membership: 'membership:policy:reviewer',
  session: 'session:policy:reviewer',
  assurance: 'assurance:policy:reviewer',
});

type PolicyAction = 'approve' | 'reject' | 'saveDraft' | 'submit';
type PolicyKind = 'field-definition' | 'tax';
type DesiredState = 'active' | 'retired';

interface PreviewReceipt {
  readonly preview: {
    readonly previewHash: string;
    readonly sourceVersion: number | string;
    readonly expiresAt: string;
  };
}

interface PolicyReceipt {
  readonly policy: {
    readonly id: string;
    readonly state: string;
    readonly desiredState: DesiredState;
    readonly version: number | string;
    readonly rule: Readonly<Record<string, unknown>>;
    readonly revisionHash: string;
  };
}

describe('authoritative configurable finance policy workflow', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await replayThroughConfigurablePolicy(database);
    await seedPolicyReviewer(database);
  }, 120_000);

  afterAll(async () => database.close());

  it('supports multiple tax policies plus new, edit and retire lifecycles with four-eyes approval', async () => {
    const first = 'policy:tax:cn:goods';
    const original = taxRule({ countryCode: 'CN', productTaxCategory: 'goods', ratePpm: 130_000 });
    const draft = await transition(database, first, proposer, 0, 'saveDraft', original, 'active', 'first:draft');
    expect(draft.policy).toEqual(expect.objectContaining({ state: 'draft', version: 1 }));
    const submitted = await transition(database, first, proposer, 1, 'submit', original, 'active', 'first:submit');
    expect(submitted.policy).toEqual(expect.objectContaining({ state: 'submitted', version: 2 }));
    const active = await transition(database, first, reviewer, 2, 'approve', original, 'active', 'first:approve');
    expect(active.policy).toEqual(expect.objectContaining({ state: 'active', version: 3, desiredState: 'active' }));

    const second = 'policy:tax:cn:services';
    const services = taxRule({ countryCode: 'CN', productTaxCategory: 'services', ratePpm: 60_000 });
    await transition(database, second, proposer, 0, 'saveDraft', services, 'active', 'second:draft');
    await transition(database, second, proposer, 1, 'submit', services, 'active', 'second:submit');
    await transition(database, second, reviewer, 2, 'approve', services, 'active', 'second:approve');
    const sameKind = await database.query<{ count: number }>(`select count(*)::int count from finance.policy where scope_id=$1 and kind='tax' and state='active'`, [scope]);
    expect(sameKind.rows[0]?.count).toBe(2);

    const changed = taxRule({ countryCode: 'CN', productTaxCategory: 'goods', ratePpm: 90_000 });
    await transition(database, first, proposer, 3, 'saveDraft', changed, 'active', 'first:edit:draft');
    await transition(database, first, proposer, 4, 'submit', changed, 'active', 'first:edit:submit');
    const edited = await transition(database, first, reviewer, 5, 'approve', changed, 'active', 'first:edit:approve');
    expect(edited.policy).toEqual(expect.objectContaining({ state: 'active', version: 6, rule: expect.objectContaining({ ratePpm: 90_000 }) }));

    await transition(database, first, proposer, 6, 'saveDraft', changed, 'retired', 'first:retire:draft');
    await transition(database, first, proposer, 7, 'submit', changed, 'retired', 'first:retire:submit');
    const retired = await transition(database, first, reviewer, 8, 'approve', changed, 'retired', 'first:retire:approve');
    expect(retired.policy).toEqual(expect.objectContaining({ state: 'retired', desiredState: 'retired', version: 9 }));
    const pointer = await database.query<{ state: string; version: number }>('select state,version::int version from finance.policy where id=$1 and scope_id=$2', [first, scope]);
    expect(pointer.rows[0]).toEqual({ state: 'retired', version: 9 });
  }, 30_000);

  it('enforces independent review, immutable kind, cross-Scope identity and active-pointer overlap', async () => {
    const selfReview = 'policy:tax:jp:self-review';
    const japan = taxRule({ countryCode: 'JP', productTaxCategory: 'goods', ratePpm: 100_000 });
    await transition(database, selfReview, proposer, 0, 'saveDraft', japan, 'active', 'self:draft');
    await transition(database, selfReview, proposer, 1, 'submit', japan, 'active', 'self:submit');
    await expect(previewPolicy(database, selfReview, proposer, 2, 'approve', 'tax', japan, 'active', 'self:approve')).rejects.toThrow('FINANCE_POLICY_SEPARATION_REQUIRED');
    const rejected = await transition(database, selfReview, reviewer, 2, 'reject', japan, 'active', 'self:reject');
    expect(rejected.policy).toEqual(expect.objectContaining({ state: 'rejected', version: 3 }));

    const activePointer = 'policy:tax:us:active-pointer';
    const unitedStates = taxRule({ countryCode: 'US', productTaxCategory: 'goods', ratePpm: 75_000 });
    await transition(database, activePointer, proposer, 0, 'saveDraft', unitedStates, 'active', 'overlap:draft');
    await transition(database, activePointer, proposer, 1, 'submit', unitedStates, 'active', 'overlap:submit');
    await transition(database, activePointer, reviewer, 2, 'approve', unitedStates, 'active', 'overlap:approve');
    await transition(database, activePointer, proposer, 3, 'saveDraft', unitedStates, 'retired', 'overlap:retire-draft');

    await expect(previewPolicy(database, 'policy:tax:us:conflict', proposer, 0, 'saveDraft', 'tax', unitedStates, 'active', 'overlap:conflict')).rejects.toThrow('FINANCE_TAX_RULE_OVERLAP');
    await expect(previewPolicy(database, activePointer, proposer, 4, 'saveDraft', 'field-definition', fieldDefinition(), 'active', 'kind:change')).rejects.toThrow('FINANCE_POLICY_KIND_IMMUTABLE');
    await expect(previewPolicy(database, activePointer, proposer, 0, 'saveDraft', 'tax', unitedStates, 'active', 'scope:reuse', alternateScope)).rejects.toThrow('FINANCE_POLICY_SCOPE_MISMATCH');
  }, 30_000);

  it('fails closed for stale and expired previews, one-time consumption and idempotency mismatch', async () => {
    const policy = 'policy:tax:au:stale';
    const australia = taxRule({ countryCode: 'AU', productTaxCategory: 'goods', ratePpm: 100_000 });
    const current = await previewPolicy(database, policy, proposer, 0, 'saveDraft', 'tax', australia, 'active', 'stale:current');
    const stale = await previewPolicy(database, policy, proposer, 0, 'saveDraft', 'tax', australia, 'active', 'stale:other');
    const managed = await managePolicy(database, policy, proposer, 0, 'saveDraft', current.preview.previewHash, 'stale:manage');
    expect(managed.policy.version).toBe(1);

    await expect(replayManageWithoutProof(database, policy, proposer, 0, 'saveDraft', current.preview.previewHash, 'stale:manage')).resolves.toEqual(managed);
    await expect(replayManageWithoutProof(database, policy, proposer, 0, 'saveDraft', current.preview.previewHash, 'stale:manage', 'changed reason')).rejects.toThrow('FINANCE_POLICY_IDEMPOTENCY_MISMATCH');
    await expect(managePolicy(database, policy, proposer, 0, 'saveDraft', stale.preview.previewHash, 'stale:execute')).rejects.toThrow('VERSION_CONFLICT');
    await expect(managePolicy(database, policy, proposer, 0, 'saveDraft', current.preview.previewHash, 'consumed:reuse')).rejects.toThrow('FINANCE_POLICY_PREVIEW_MISMATCH');

    const wrongHashPolicy = 'policy:tax:gb:wrong-hash';
    const unitedKingdom = taxRule({ countryCode: 'GB', productTaxCategory: 'goods', ratePpm: 200_000 });
    const wrongHashPreview = await previewPolicy(database, wrongHashPolicy, proposer, 0, 'saveDraft', 'tax', unitedKingdom, 'active', 'wrong-hash:preview');
    await expect(managePolicy(database, wrongHashPolicy, proposer, 0, 'saveDraft', wrongHashPreview.preview.previewHash, 'wrong-hash:manage', undefined, undefined, 'f'.repeat(64))).rejects.toThrow('ACTION_PROOF_REQUIRED');

    const expiredPolicy = 'policy:tax:nz:expired';
    const expiredHash = digest('policy:expired:preview');
    const expiredRule = taxRule({ countryCode: 'NZ', productTaxCategory: 'goods', ratePpm: 150_000 });
    await database.query(
      `insert into finance.policypreview(id,policy_id,scope_id,action,kind,rule,desired_state,effective_from,effective_to,
        source_version,source_hash,preview_hash,proposed_by,idempotency_key,created_at,expires_at)
      values('preview:expired',$1,$2,'saveDraft','tax',$3::jsonb,'active',$4::date,$5::date,0,$6,$7,$8,
        'preview:expired',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute')`,
      [expiredPolicy, scope, JSON.stringify(expiredRule), expiredRule.effectiveFrom, expiredRule.effectiveTo ?? null, digest(`absent:${scope}:${expiredPolicy}`), expiredHash, proposer.actor]
    );
    await expect(managePolicy(database, expiredPolicy, proposer, 0, 'saveDraft', expiredHash, 'expired:manage')).rejects.toThrow('FINANCE_POLICY_PREVIEW_EXPIRED');
  }, 30_000);

  it('enforces database validation and RLS/raw-write boundaries', async () => {
    const fieldPolicy = 'policy:field:accounts-receivable:labels';
    const fieldRule = Object.freeze({
      ...fieldDefinition(),
      code: 'accounts_receivable.labels',
      appliesTo: 'accounts_receivable',
      dataType: 'multiselect',
      options: ['domestic', 'cross_border'],
    });
    const fieldDraftPreview = await previewPolicy(database, fieldPolicy, proposer, 0, 'saveDraft', 'field-definition', fieldRule, 'active', 'field:draft');
    await managePolicy(database, fieldPolicy, proposer, 0, 'saveDraft', fieldDraftPreview.preview.previewHash, 'field:draft');
    const fieldSubmitPreview = await previewPolicy(database, fieldPolicy, proposer, 1, 'submit', 'field-definition', fieldRule, 'active', 'field:submit');
    await managePolicy(database, fieldPolicy, proposer, 1, 'submit', fieldSubmitPreview.preview.previewHash, 'field:submit');
    const fieldApprovePreview = await previewPolicy(database, fieldPolicy, reviewer, 2, 'approve', 'field-definition', fieldRule, 'active', 'field:approve');
    const fieldActive = await managePolicy(database, fieldPolicy, reviewer, 2, 'approve', fieldApprovePreview.preview.previewHash, 'field:approve');
    expect(fieldActive.policy).toEqual(expect.objectContaining({ state: 'active', version: 3, rule: expect.objectContaining({ dataType: 'multiselect' }) }));

    await expect(
      previewPolicy(database, 'policy:tax:invalid-rate', proposer, 0, 'saveDraft', 'tax', { ...taxRule({ countryCode: 'DE', productTaxCategory: 'goods', ratePpm: 190_000 }), ratePpm: 1_000_001 }, 'active', 'invalid:rate')
    ).rejects.toThrow('FINANCE_TAX_RULE_INVALID');

    const hidden = await inAppTransaction(database, { actor: 'member-test-storefront', membership: 'membership-test-storefront', session: '', assurance: '' }, alternateScope, async () => {
      const result = await database.query<{ count: number }>('select count(*)::int count from finance.policyrevision where scope_id=$1', [scope]);
      return result.rows[0]?.count ?? -1;
    });
    expect(hidden).toBe(0);
    await expect(inAppTransaction(database, proposer, scope, async () => database.exec(`update finance.policyrevision set evidence=evidence where policy_id='policy:tax:cn:goods'`))).rejects.toThrow(/permission denied/i);
  }, 30_000);
});

async function transition(database: PGlite, policy: string, actor: Actor, expectedVersion: number, action: PolicyAction, rule: Readonly<Record<string, unknown>>, desiredState: DesiredState, key: string): Promise<PolicyReceipt> {
  const preview = await previewPolicy(database, policy, actor, expectedVersion, action, 'tax', rule, desiredState, `preview:${key}`);
  return managePolicy(database, policy, actor, expectedVersion, action, preview.preview.previewHash, `manage:${key}`);
}

async function previewPolicy(
  database: PGlite,
  policy: string,
  actor: Actor,
  expectedVersion: number,
  action: PolicyAction,
  kind: PolicyKind,
  rule: Readonly<Record<string, unknown>>,
  desiredState: DesiredState,
  idempotency: string,
  targetScope = scope
): Promise<PreviewReceipt> {
  return asApp(
    database,
    actor,
    targetScope,
    `select finance.preview_configurable_policy(
    $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::date,$11::date) receipt`,
    [policy, targetScope, actor.actor, idempotency, expectedVersion, action, kind, JSON.stringify(rule), desiredState, rule.effectiveFrom, rule.effectiveTo ?? null]
  );
}

async function managePolicy(
  database: PGlite,
  policy: string,
  actor: Actor,
  expectedVersion: number,
  action: PolicyAction,
  previewHash: string,
  idempotency: string,
  reason = `Policy action ${idempotency}`,
  evidence: Readonly<Record<string, unknown>> = Object.freeze({ source: 'finance-policy-test' }),
  functionRequestHash?: string
): Promise<PolicyReceipt> {
  const requestHash = manageRequestHash(policy, actor, expectedVersion, action, previewHash, idempotency, reason, evidence);
  const proof = digest(`proof:${actor.actor}:${idempotency}:${requestHash}`);
  await database.query(`select * from access.issue_action_proof($1,$2,$3,$4,$5,'finance.policies.manage',$6,$7,$8,$9)`, [
    proof,
    actor.actor,
    actor.session,
    actor.membership,
    actor.assurance,
    scope,
    idempotency,
    expectedVersion,
    requestHash,
  ]);
  return inAppTransaction(database, actor, scope, async () => {
    const consumed = await database.query<{ accepted: boolean }>(`select access.consume_action_proof($1,$2,$3,$4,$5,'finance.policies.manage',$6,$7,$8,$9) accepted`, [
      proof,
      actor.actor,
      actor.session,
      actor.membership,
      scope,
      scope,
      idempotency,
      expectedVersion,
      requestHash,
    ]);
    if (consumed.rows[0]?.accepted !== true) throw new Error('TEST_ACTION_PROOF_NOT_CONSUMED');
    const result = await database.query<{ receipt: PolicyReceipt }>(`select finance.manage_configurable_policy($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) receipt`, [
      policy,
      scope,
      actor.actor,
      idempotency,
      expectedVersion,
      action,
      previewHash,
      reason,
      JSON.stringify(evidence),
      functionRequestHash ?? requestHash,
    ]);
    return result.rows[0]!.receipt;
  });
}

async function replayManageWithoutProof(
  database: PGlite,
  policy: string,
  actor: Actor,
  expectedVersion: number,
  action: PolicyAction,
  previewHash: string,
  idempotency: string,
  reason = `Policy action ${idempotency}`,
  evidence: Readonly<Record<string, unknown>> = Object.freeze({ source: 'finance-policy-test' })
): Promise<PolicyReceipt> {
  const requestHash = manageRequestHash(policy, actor, expectedVersion, action, previewHash, idempotency, reason, evidence);
  return asApp(
    database,
    actor,
    scope,
    `select finance.manage_configurable_policy(
    $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) receipt`,
    [policy, scope, actor.actor, idempotency, expectedVersion, action, previewHash, reason, JSON.stringify(evidence), requestHash]
  );
}

function manageRequestHash(policy: string, actor: Actor, expectedVersion: number, action: PolicyAction, previewHash: string, idempotency: string, reason: string, evidence: Readonly<Record<string, unknown>>): string {
  return digest(JSON.stringify({ policy, actor: actor.actor, expectedVersion, action, previewHash, idempotency, reason, evidence }));
}

async function asApp<T>(database: PGlite, actor: Actor, targetScope: string, statement: string, values: readonly unknown[] = []): Promise<T> {
  return inAppTransaction(database, actor, targetScope, async () => {
    const result = await database.query<{ receipt: T }>(statement, [...values]);
    return result.rows[0]!.receipt;
  });
}

async function inAppTransaction<T>(database: PGlite, actor: Actor, targetScope: string, action: () => Promise<T>): Promise<T> {
  await database.exec('begin');
  try {
    await database.query(
      `select set_config('app.scope_id',$1,true),set_config('app.actor_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.workload','api',true)`,
      [targetScope, actor.actor, actor.membership]
    );
    await database.exec('set local role shopapp');
    const result = await action();
    await database.exec('commit');
    return result;
  } catch (cause) {
    await database.exec('rollback');
    throw cause;
  }
}

async function seedPolicyReviewer(database: PGlite): Promise<void> {
  await database.exec(`
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('${reviewer.actor}','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:policy:reviewer','${reviewer.actor}','Policy Reviewer','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    select '${reviewer.membership}','member:policy:reviewer',organization_id,'operator','active',1,clock_timestamp()
    from access.membership where id='${proposer.membership}';
    insert into access.role(id,scope_id,name,status,version)
    values('role:policy:reviewer','tenant-zhudatuan','Policy Reviewer','active',0);
    insert into access.rolepermission(role_id,permission_id,effect)
    select 'role:policy:reviewer',id,'allow' from access.permission
    where code='finance.policy.manage' and status='active';
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
    values('${reviewer.membership}','role:policy:reviewer','1970-01-01T00:00:00Z',null,'${proposer.actor}');
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
    values
      ('scope:membership:policy:reviewer:platform','${reviewer.membership}','platform','organization-platform-root',
        'organization-platform-root','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership:policy:reviewer:tenant','${reviewer.membership}','tenant','tenant-zhudatuan',
        'tenant-zhudatuan','allow','1970-01-01T00:00:00Z',1);
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('${proposer.session}','${proposer.actor}','${proposer.membership}',repeat('1',64),
      (select credential_version from identity.principal where id='${proposer.actor}'),
      (select access_version from access.membership where id='${proposer.membership}'),'console',repeat('2',64),
      'test','proposer',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
    ('${reviewer.session}','${reviewer.actor}','${reviewer.membership}',repeat('3',64),1,1,'console',repeat('4',64),
      'test','reviewer',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
    values('${proposer.assurance}','${proposer.actor}','${proposer.session}','otp',3,repeat('5',64),
      clock_timestamp(),clock_timestamp()+interval '30 minutes'),
    ('${reviewer.assurance}','${reviewer.actor}','${reviewer.session}','otp',3,repeat('6',64),
      clock_timestamp(),clock_timestamp()+interval '30 minutes');
  `);
}

async function replayThroughConfigurablePolicy(database: PGlite): Promise<void> {
  await database.exec(`create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit;
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);`);
  const files = (await readdir(migrations)).filter((name) => name.endsWith('.sql') && name <= '20260830100000_finance_configurable_policy_workflow.sql').sort();
  for (const name of files) {
    if (name === '20260817191000_bootstrap_ethan_platform_owner.sql') await seedOwner(database);
    if (name === '20260829200000_owner_identity_reset_foundation.sql') await seedOwnerBoundaryFixture(database);
    if (name === '20260821026000_backfill_domain_data.sql') await stageSecrets(database);
    try {
      await database.exec(await readFile(`${migrations}/${name}`, 'utf8'));
    } catch (cause) {
      throw new Error(`MIGRATION_REPLAY_FAILED:${name}`, { cause });
    }
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
  }
}

async function seedOwner(database: PGlite): Promise<void> {
  await database.exec(`insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN',
      'Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status)
    values('member-fresh-replay-ethan','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id)
    values('local_username','ethan','member-fresh-replay-ethan');`);
}

async function seedOwnerBoundaryFixture(database: PGlite): Promise<void> {
  await database.exec(`
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('${proposer.actor}','active',1,clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active';
    insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at)
    values('credential:password:zhudatuan-owner-ethan:v1','${proposer.actor}','password',
      encode(digest('fresh-replay-owner','sha256'),'hex'),'fixture-owner-secret','active',clock_timestamp(),clock_timestamp())
    on conflict(id) do update set status='active';
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:zhudatuan:owner:ethan:v1','${proposer.actor}','Fresh Replay Owner','active',clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active',principal_id=excluded.principal_id;
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('${proposer.membership}','member:zhudatuan:owner:ethan:v1','tenant-zhudatuan','operator','active',1,clock_timestamp())
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,client='operator',status='active';
    delete from access.membershiprole where membership_id='${proposer.membership}'
      and role_id in('role-platform-owner-v2','role:self');
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('${proposer.membership}','role-platform-owner-v2','1970-01-01T00:00:00Z'),
      ('${proposer.membership}','role:self','1970-01-01T00:00:00Z');
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:membership-platform-owner-ethan-v1:platform','${proposer.membership}','platform','organization-platform-root','organization-platform-root','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:tenant','${proposer.membership}','tenant','tenant-zhudatuan','tenant-zhudatuan','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:self','${proposer.membership}','self','self:${proposer.actor}','self:${proposer.actor}','allow','1970-01-01T00:00:00Z',1)
    on conflict do nothing;
  `);
}

async function stageSecrets(database: PGlite): Promise<void> {
  await database.exec(`insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),
      'fixture-v1',created_at from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),
      'fixture-v1',created_at from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),
      'fixture-v1',created_at from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`);
}

function taxRule(overrides: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({
    name: 'Authoritative tax rule',
    countryCode: 'CN',
    taxType: 'vat',
    productTaxCategory: 'goods',
    ratePpm: 130_000,
    priceInclusive: true,
    calculationMethod: 'inclusive',
    roundingMode: 'line',
    priority: 100,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    sourceReference: 'POLICY-TEST-2026',
    ...overrides,
  });
}

function fieldDefinition(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    code: 'tax.review_note',
    label: 'Review note',
    appliesTo: 'tax_rule',
    dataType: 'text',
    required: false,
    options: [],
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
  });
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
