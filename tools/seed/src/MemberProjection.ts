import type { Client } from 'pg';

export async function syncMemberProjection(database: Client, member: string): Promise<void> {
  await database.query(
    `insert into access.memberprofile(member_id,display_name,mobile_masked,source_version,updated_at)
    select id,display_name,mobile_masked,version,updated_at from member.profile where id=$1
    on conflict(member_id) do update set display_name=excluded.display_name,mobile_masked=excluded.mobile_masked,
    source_version=excluded.source_version,updated_at=excluded.updated_at
    where access.memberprofile.source_version<=excluded.source_version`,
    [member]
  );
}
