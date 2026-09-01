import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { MemberCatalogPort } from '../../../catalog/public/MemberCatalogPort';
import type { ImportRecord, MemberProfile, MemberRepository, MembershipProfile } from '../../application/port/MemberRepository';
interface ProfileRow {
  readonly id: string;
  readonly display_name: string;
  readonly status: string;
  readonly mobile_bound?: boolean;
}
interface ImportRow extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly state: string;
  readonly report_object_ref: string | null;
  readonly report_sha256: string | null;
  readonly report_size: number | string | null;
}
export class PgMemberRepository implements MemberRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly access: MemberAccessPort,
    private readonly catalog: MemberCatalogPort
  ) {}
  async memberships(context: ReadTransactionContext, organization: string, after: string | null, fetch: number): Promise<readonly MembershipProfile[]> {
    const database = this.transactions.database(context);
    const rows = await this.access.members(context, organization, after, fetch);
    return rows.map((row) => {
      if (!(row.joinedat instanceof Date)) throw new Error('MEMBERSHIP_JOINED_AT_REQUIRED');
      return Object.freeze({ id: row.id, member: row.member, organization: row.organization, employee: row.employee, status: row.status, accessVersion: row.accessversion, joinedAt: row.joinedat.toISOString() });
    });
  }
  async profiles(context: ReadTransactionContext, members: readonly string[]): Promise<readonly MemberProfile[]> {
    const database = this.transactions.database(context);
    if (members.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<ProfileRow>('select id,display_name,status from member.profile where id=any($1::text[])', [members]);
    return result.rows.map(profile);
  }
  async membership(context: ReadTransactionContext, membership: string): Promise<MembershipProfile> {
    const database = this.transactions.database(context);
    const row = await this.access.profile(context, membership);
    if (!(row.joinedat instanceof Date)) throw new Error('MEMBERSHIP_JOINED_AT_REQUIRED');
    return Object.freeze({ id: row.id, member: row.member, organization: row.organization, employee: row.employee, status: row.status, accessVersion: row.accessversion, joinedAt: row.joinedat.toISOString() });
  }
  async profile(context: ReadTransactionContext, member: string): Promise<MemberProfile | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<ProfileRow>('select id,display_name,status,mobile_token is not null mobile_bound from member.profile where id=$1', [member]);
    return result.rows[0] ? profile(result.rows[0]) : null;
  }
  async favorites(context: ReadTransactionContext, member: string, sort: string | null, id: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select listing_id "listingId",created_at "createdAt" from member.favorite
      where member_id=$1 and ($2::timestamptz is null or (created_at,listing_id)<($2::timestamptz,$3))
      order by created_at desc,listing_id desc limit $4`,
      [member, sort, id, fetch]
    );
    return result.rows.map((row) => Object.freeze({ ...row }));
  }
  async putFavorite(context: WriteTransactionContext, member: string, listing: string, organization: string, favorite: boolean): Promise<Readonly<Record<string, unknown>>> {
    const database = this.transactions.database(context);
    if (!favorite) {
      await database.query('delete from member.favorite where member_id=$1 and listing_id=$2', [member, listing]);
      return Object.freeze({ listingId: listing, favorite: false, createdAt: null });
    }
    if (!(await this.catalog.published(context, listing, organization))) throw new Error('MEMBER_FAVORITE_LISTING_NOT_FOUND');
    const result = await database.query<{
      listingId: string;
      createdAt: Date;
    }>(
      `with inserted as (
        insert into member.favorite(member_id,listing_id,created_at) values($1,$2,clock_timestamp())
        on conflict(member_id,listing_id) do nothing returning listing_id,created_at)
      select listing_id "listingId",created_at "createdAt" from inserted union all
      select favorite.listing_id "listingId",favorite.created_at "createdAt" from member.favorite favorite
      where favorite.member_id=$1 and favorite.listing_id=$2 and not exists(select 1 from inserted) limit 1`,
      [member, listing]
    );
    return Object.freeze({ ...result.rows[0]!, favorite: true });
  }
  async createImport(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      organization: string;
      reference: string;
      sha256: string;
    }>
  ): Promise<Readonly<Record<string, unknown>>> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into member.importjob(id,organization_id,object_ref,sha256,state,created_at,updated_at)
      values($1,$2,$3,$4,'uploaded',clock_timestamp(),clock_timestamp())
      returning id,state,total_count,cursor_value,success_count,failure_count,created_at,updated_at`,
      [input.id, input.organization, input.reference, input.sha256]
    );
    return Object.freeze({ ...result.rows[0]! });
  }
  async readImport(context: ReadTransactionContext, id: string, organization: string): Promise<ImportRecord | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<ImportRow>(
      `select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
      job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
      coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
        (select row_number,reason_code,field,detail from member.importerror where job_id=job.id order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
      from member.importjob job where job.id=$1 and job.organization_id=$2`,
      [id, organization]
    );
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({ ...row, reportObjectRef: row.report_object_ref, reportSha256: row.report_sha256, reportSize: row.report_size === null ? null : Number(row.report_size) });
  }
}
function profile(row: ProfileRow): MemberProfile {
  return Object.freeze({ id: row.id, displayName: row.display_name, status: row.status, mobileBound: row.mobile_bound === true });
}
