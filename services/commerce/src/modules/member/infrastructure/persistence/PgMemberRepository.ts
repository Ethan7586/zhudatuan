import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { MemberListProfile, MemberProfile, MemberRepository, MembershipProfile } from '../../application/port/MemberRepository';
import { Preference } from '../../domain/model/Preference';
interface ProfileRow {
  readonly id: string;
  readonly display_name: string;
  readonly status: string;
  readonly mobile_bound?: boolean;
  readonly login_identity_bound?: boolean;
}
interface FullProfileRow extends ProfileRow {
  readonly locale: string;
  readonly timezone: string;
  readonly marketing_allowed: boolean;
  readonly preference_version: number | string;
}
export class PgMemberRepository implements MemberRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly access: MemberAccessPort
  ) {}
  async memberships(context: ReadTransactionContext, organization: string, actorMembership: string, after: string | null, fetch: number): Promise<readonly MembershipProfile[]> {
    const database = this.transactions.database(context);
    const rows = await this.access.members(context, organization, actorMembership, after, fetch);
    return rows.map((row) => {
      if (!(row.joinedat instanceof Date)) throw new Error('MEMBERSHIP_JOINED_AT_REQUIRED');
      return Object.freeze({
        id: row.id,
        member: row.member,
        organization: row.organization,
        employee: row.employee,
        status: row.status,
        accessVersion: row.accessversion,
        joinedAt: row.joinedat.toISOString(),
        registrationResetAllowed: row.registrationresetallowed,
        registrationResetBlockReason: row.registrationresetblockreason,
      });
    });
  }
  async profiles(context: ReadTransactionContext, members: readonly string[]): Promise<readonly MemberListProfile[]> {
    if (members.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<ProfileRow>(
      `select id,display_name,status,status in('pending','active') login_identity_bound
      from member.profile where id=any($1::text[])`,
      [members]
    );
    return result.rows.map(profileListItem);
  }
  async membership(context: ReadTransactionContext, membership: string): Promise<MembershipProfile> {
    const row = await this.access.profile(context, membership);
    if (!(row.joinedat instanceof Date)) throw new Error('MEMBERSHIP_JOINED_AT_REQUIRED');
    return Object.freeze({
      id: row.id,
      member: row.member,
      organization: row.organization,
      employee: row.employee,
      status: row.status,
      accessVersion: row.accessversion,
      joinedAt: row.joinedat.toISOString(),
      registrationResetAllowed: row.registrationresetallowed,
      registrationResetBlockReason: row.registrationresetblockreason,
    });
  }
  async profile(context: ReadTransactionContext, member: string): Promise<MemberProfile | null> {
    const result = await this.transactions.database(context).query<FullProfileRow>(
      `select id,display_name,status,mobile_token is not null mobile_bound,
      status in('pending','active') login_identity_bound,preference.locale,preference.timezone,
      preference.marketing_allowed,preference.version preference_version
      from member.profile join member.preference preference on preference.member_id=profile.id where profile.id=$1`,
      [member]
    );
    return result.rows[0] ? profile(result.rows[0]) : null;
  }
}
function profileListItem(row: ProfileRow): MemberListProfile {
  return Object.freeze({ id: row.id, displayName: row.display_name, status: row.status, mobileBound: row.mobile_bound === true, loginIdentityBound: row.login_identity_bound === true });
}

function profile(row: FullProfileRow): MemberProfile {
  const preference = new Preference({
    member: row.id,
    locale: row.locale,
    timezone: row.timezone,
    marketingAllowed: row.marketing_allowed === true,
    version: Number(row.preference_version),
  });
  return Object.freeze({
    ...profileListItem(row),
    locale: preference.locale,
    timezone: preference.timezone,
    marketingAllowed: preference.marketingAllowed,
    preferenceVersion: preference.version,
  });
}
