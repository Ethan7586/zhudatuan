import { createHash } from 'node:crypto';
import type { Client } from 'pg';

interface SubjectCollision {
  readonly active_sessions: number;
  readonly credential_id: string;
  readonly credential_status: string;
  readonly membership_count: number;
  readonly memberships_safe: boolean;
  readonly principal_id: string;
  readonly principal_status: string;
  readonly profiles_safe: boolean;
}

export async function releaseRetiredAcceptanceSubject(database: Client, provider: 'otp' | 'password', subjectHash: string, targetPrincipal: string): Promise<void> {
  const collision = await database.query<SubjectCollision>(
    `select credential.id credential_id,credential.principal_id,credential.status credential_status,
      principal.status principal_status,
      count(distinct profile.id)::integer profile_count,
      count(distinct membership.id)::integer membership_count,
      coalesce(bool_and(profile.id=credential.principal_id and profile.status='disabled'),false) profiles_safe,
      coalesce(bool_and(membership.organization_id='mall-demo' and membership.status='suspended'),false) memberships_safe,
      (select count(*)::integer from identity.session session
        where session.principal_id=credential.principal_id and session.revoked_at is null) active_sessions
    from identity.credential credential
    join identity.principal principal on principal.id=credential.principal_id
    left join member.profile profile on profile.principal_id=credential.principal_id
    left join access.membership membership on membership.principal_id=credential.principal_id
    where credential.provider=$1 and credential.subject_hash=$2 and credential.principal_id<>$3
    group by credential.id,credential.principal_id,credential.status,principal.status`,
    [provider, subjectHash, targetPrincipal]
  );
  if (collision.rows.length === 0) return;
  const record = collision.rows[0]!;
  const expectedCredential = `credential:${provider}:${record.principal_id}`;
  const safe =
    collision.rows.length === 1 &&
    record.principal_id.match(/^member-registration-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/) !== null &&
    record.credential_id === expectedCredential &&
    record.credential_status === 'revoked' &&
    record.principal_status === 'disabled' &&
    record.membership_count > 0 &&
    record.profiles_safe &&
    record.memberships_safe &&
    record.active_sessions === 0;
  if (!safe) throw new Error(`ACCEPTANCE_SUBJECT_COLLISION:${provider}`);

  const archivedHash = createHash('sha256').update(`retired:${record.credential_id}:${subjectHash}`).digest('hex');
  const released = await database.query(
    `update identity.credential set subject_hash=$3,rotated_at=coalesce(rotated_at,clock_timestamp())
      where id=$1 and subject_hash=$2 and status='revoked'`,
    [record.credential_id, subjectHash, archivedHash]
  );
  if (released.rowCount !== 1) throw new Error(`ACCEPTANCE_SUBJECT_RELEASE_FAILED:${provider}`);
}
