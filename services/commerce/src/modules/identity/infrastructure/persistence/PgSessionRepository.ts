import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { randomUUID } from 'node:crypto';
import type { SessionListRecord, SessionRecord, SessionRepository, SessionRevocation } from '../../application/port/SessionRepository';
import type { QueryPage } from '../../../../foundation/interface/Validation';

export class PgSessionRepository implements SessionRepository {
  async credentialVersion(database: OperationDatabase, principal: string): Promise<number> {
    const result = await database.query<{ credential_version: number }>(
      `select credential_version from identity.principal
      where id=$1 and status='active' for update`,
      [principal]
    );
    const version = result.rows[0]?.credential_version;
    if (version === undefined) reject('MEMBERSHIP_SELECTION_REQUIRED');
    return Number(version);
  }

  async create(database: OperationDatabase, value: SessionRecord): Promise<void> {
    const session = value.session;
    await database.query(
      `insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp(),clock_timestamp())`,
      [session.id, session.principal, session.membership, value.tokenHash, session.credentialVersion, session.accessVersion, session.target, value.ipHash, value.userAgent, value.deviceLabel, session.assurance, session.expiresAt]
    );
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,'identity.session.created',1,'session',$2,$3,$4::jsonb,$5,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, session.id, session.membership, JSON.stringify({ principalId: session.principal, membershipId: session.membership, assurance: session.assurance }), value.trace]
    );
  }

  async revokeCurrent(database: OperationDatabase, principal: string, session: string): Promise<SessionRevocation | null> {
    const result = await database.query<{ id: string; revoked_at: Date }>(
      `update identity.session set revoked_at=clock_timestamp(),
      revoked_reason='logout' where id=$1 and principal_id=$2 and revoked_at is null returning id,revoked_at`,
      [session, principal]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, revokedAt: row.revoked_at }) : null;
  }

  async revokeSelected(database: OperationDatabase, principal: string, current: string, target: string): Promise<readonly string[]> {
    const result =
      target === 'others'
        ? await database.query<{ id: string }>(
            `update identity.session set revoked_at=clock_timestamp(),
      revoked_reason='security_center' where principal_id=$1 and id<>$2 and revoked_at is null returning id`,
            [principal, current]
          )
        : await database.query<{ id: string }>(
            `update identity.session set revoked_at=clock_timestamp(),revoked_reason='security_center'
      where principal_id=$1 and id=$2 and revoked_at is null returning id`,
            [principal, target]
          );
    return Object.freeze(result.rows.map(({ id }) => id));
  }

  async owns(database: OperationDatabase, principal: string, session: string): Promise<boolean> {
    const result = await database.query('select 1 from identity.session where principal_id=$1 and id=$2', [principal, session]);
    return Boolean(result.rows[0]);
  }

  async elevate(database: OperationDatabase, principal: string, session: string, assurance: 1 | 2 | 3): Promise<boolean> {
    const result = await database.query(
      `update identity.session set assurance_level=greatest(assurance_level,$3),
      last_seen_at=clock_timestamp() where id=$1 and principal_id=$2 and revoked_at is null returning id`,
      [session, principal, assurance]
    );
    return Boolean(result.rows[0]);
  }

  async list(database: OperationDatabase, principal: string, current: string, page: QueryPage): Promise<readonly SessionListRecord[]> {
    const result = await database.query<SessionListRecord>(
      `select id,membership_id as membership,
      case when client='storefront' then 'storefront' else 'console' end client,device_label as "deviceLabel",
      user_agent as "userAgent",assurance_level as assurance,created_at as "createdAt",last_seen_at as "lastSeenAt",
      expires_at as "expiresAt",id=$2 as current from identity.session where principal_id=$1 and revoked_at is null
      and expires_at>clock_timestamp() and ($3::timestamptz is null or (last_seen_at,id)<($3::timestamptz,$4))
      order by last_seen_at desc,id desc limit $5`,
      [principal, current, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async advance(database: OperationDatabase, principal: string): Promise<number> {
    const bumped = await database.query<{ credential_version: number }>(
      `update identity.principal
      set credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning credential_version`,
      [principal]
    );
    const version = bumped.rows[0]?.credential_version;
    if (version === undefined) reject('AUTHENTICATION_REQUIRED');
    await database.query(
      `update identity.session set credential_version=$2 where principal_id=$1 and revoked_at is null
      and expires_at>clock_timestamp()`,
      [principal, version]
    );
    return version;
  }
}
