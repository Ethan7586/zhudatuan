import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, reject, requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { VoucherPort } from '../../../voucher/VoucherModule';

export function verificationOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const vouchers = new VoucherPort();
  return new ModuleOperations('verification', pool, context.container.get(AUDIT_SINK), {
    'verification.sessions.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 100);
      const result = await database.query(`select session.id,session.subject_type,session.subject_id,session.purpose,session.state,session.expires_at,session.version
        from access.membership membership join verification.session session on session.subject_id=membership.member_id
        where membership.id=$1 and ($2::timestamptz is null or (session.expires_at,session.id)<($2::timestamptz,$3))
        order by session.expires_at desc,session.id desc limit $4`, [access.membership.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'expires_at');
    },
    'verification.challenges.issue': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const purpose = purposeField(body.purpose);
      const member = await database.query<{ id: string; organization_id: string }>(`select profile.id,membership.organization_id from access.membership membership
        join member.profile profile on profile.id=membership.member_id where membership.id=$1 and membership.status='active'`, [access.membership.id]);
      if (!member.rows[0]) reject(403, 'VERIFICATION_MEMBER_INACTIVE');
      let subjectType = 'member';
      let subject = member.rows[0].id;
      let scope = member.rows[0].organization_id;
      if (purpose === 'voucher_redeem') {
        subjectType = 'voucher';
        subject = textField(body, 'voucher');
        const voucherScope = await vouchers.redeemableScope(database, subject, member.rows[0].id);
        if (!voucherScope) reject(409, 'VOUCHER_NOT_REDEEMABLE');
        scope = voucherScope;
      }
      const nonce = randomBytes(32).toString('base64url');
      const id = `verification:${randomUUID()}`;
      const result = await database.query(`with session as (insert into verification.session(id,scope_id,subject_type,subject_id,purpose,state,expires_at,version)
        values($1,$2,$3,$4,$5,'issued',clock_timestamp()+interval '60 seconds',0) returning id,subject_type,subject_id,purpose,state,expires_at,version), nonce as
        (insert into verification.nonce(session_id,nonce_hash,issued_at) values($1,$6,clock_timestamp())) select * from session`,
      [id, scope, subjectType, subject, purpose, digest(nonce)]);
      return { ...rowResult(result, 201), body: { ...result.rows[0], nonce } };
    },
    'verification.challenges.verify': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const challenge = request.input.path.challengeid!;
      const nonce = textField(body, 'nonce', 256);
      const deviceHash = digest(textField(body, 'device', 512));
      const device = await database.query<{ id: string }>(`select id from verification.device where scope_id=$1 and fingerprint_hash=$2 and status='trusted'`, [access.scope.id, deviceHash]);
      if (!device.rows[0]) reject(403, 'VERIFICATION_DEVICE_DENIED');
      const consumed = await database.query<{ subject_type: string; subject_id: string; purpose: string; scope_id: string }>(`with consumed as (
        update verification.nonce nonce set consumed_at=clock_timestamp() from verification.session session
        where nonce.session_id=$1 and nonce.nonce_hash=$2 and nonce.consumed_at is null and session.id=nonce.session_id
          and (session.scope_id=$3 or exists(select 1 from organization.unitclosure where ancestor_id=session.scope_id and descendant_id=$3))
          and session.state='issued' and session.expires_at>clock_timestamp() returning session.subject_type,session.subject_id,session.purpose,session.scope_id
      ), changed as (update verification.session set state='verified',version=version+1 where id=$1 and exists(select 1 from consumed) returning id)
      select * from consumed`, [challenge, digest(nonce), access.scope.id]);
      const result = consumed.rows[0];
      const outcome = result ? 'accepted' : 'replayed';
      await database.query(`insert into verification.attempt(id,session_id,nonce_hash,device_id,result,reason,trace_id,attempted_at)
        values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()) on conflict(session_id,nonce_hash) do nothing`, [`attempt:${randomUUID()}`, challenge, digest(nonce), device.rows[0]!.id, outcome, result ? 'verified' : 'nonce_unavailable', access.trace]);
      if (!result) reject(409, 'VERIFICATION_NONCE_REPLAYED');
      const record = result.purpose === 'voucher_redeem'
        ? await redeem(database, vouchers, result.subject_id, challenge, result.scope_id, access)
        : `attempt:${challenge}`;
      return { status: 200, body: { record, verified: true, subjectType: result.subject_type, subject: result.subject_id, purpose: result.purpose } };
    },
    'verification.history.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const result = await database.query(`select attempt.id,attempt.session_id,session.subject_type,session.subject_id,session.purpose,
        attempt.device_id,attempt.result,attempt.reason,attempt.attempted_at from verification.attempt attempt
        join verification.session session on session.id=attempt.session_id where (session.scope_id=$1 or exists(
          select 1 from organization.unitclosure where ancestor_id=session.scope_id and descendant_id=$1))
        and ($2::timestamptz is null or (attempt.attempted_at,attempt.id)<($2::timestamptz,$3))
        order by attempt.attempted_at desc,attempt.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'attempted_at');
    },
    'verification.devices.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const result = await database.query(`select id,label,status,version from verification.device where scope_id=$1
        and ($2::text is null or (label,id)>($2,$3)) order by label,id limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'label');
    },
    'verification.devices.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const status = body.status === 'blocked' ? 'blocked' : body.status === 'retired' ? 'retired' : 'trusted';
      const result = await database.query(`insert into verification.device(id,scope_id,label,fingerprint_hash,public_key,status,version)
        values($1,$2,$3,$4,$5,$6,0) on conflict(id) do update set label=excluded.label,fingerprint_hash=excluded.fingerprint_hash,
          public_key=excluded.public_key,status=excluded.status,version=verification.device.version+1
        where verification.device.scope_id=$2 and ($7::bigint is null or verification.device.version=$7) returning id,label,status,version`,
      [request.input.path.deviceid!, access.scope.id, textField(body, 'label'), digest(textField(body, 'fingerprint', 512)), body.publicKey ?? null,
        status, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
  });
}

async function redeem(database: import('../../../foundation/application/ModuleOperations').OperationDatabase, vouchers: VoucherPort,
  voucher: string, challenge: string, scope: string,
  access: ReturnType<typeof requireAccess>): Promise<string> {
  const accepted = await vouchers.redeemVerification(database, { voucher, verification: challenge, scope, actor: access.actor.id });
  if (!accepted) reject(409, 'VOUCHER_REDEMPTION_CONFLICT');
  await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,'voucher.redeemed',1,'voucher',$2,$3,jsonb_build_object('voucher',$2,'redemption',$4,'amountMinor',$5,'currency','CNY','mall',$3,
      'store',$6,'scopes',(select jsonb_agg(ancestor_id order by depth) from organization.unitclosure where descendant_id=$3),
      'timezone',(select timezone from organization.organization where id=$3)),$7,clock_timestamp(),clock_timestamp())`,
  [`event:${randomUUID()}`, voucher, scope, accepted.id, accepted.amountMinor, access.scope.id, access.trace]);
  return accepted.id;
}

function purposeField(value: unknown): 'member_code' | 'voucher_redeem' {
  if (value === undefined || value === 'member_code') return 'member_code';
  if (value === 'voucher_redeem') return 'voucher_redeem';
  throw new Error('VERIFICATION_PURPOSE_UNSUPPORTED');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
