import { financeLifecycle, type FinanceEntries } from './FinanceOperation';
/** Invoice persistence queries. */
import { DomainError } from '../../../../foundation/domain/DomainError';

import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { keysetResult, queryPage } from '../../../../foundation/application/Validation';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import type { MemberAccessPort } from '../../../access/public';

export function invoiceQueries(members: MemberAccessPort, objects: Pick<ObjectStore, 'authorize'>): FinanceEntries<'profilesRead' | 'requestsRead' | 'invoicesRead' | 'invoicesDownload'> {
  return {
    profilesRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const member = await members.member(database.transaction, access.membership.id);
      const result = await database.query(
        `select profile.id,profile.status,profile.version from invoice.profile profile where profile.owner_id=$1 and profile.status='active'
        and ($2::text is null or profile.id>$2) order by profile.id limit $3`,
        [member, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    requestsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select request.id,request.profile_id,request.settlement_id,request.amount_minor,request.currency,
        request.state,request.created_at,request.version,request.requested_by,request.approved_by,request.reason,request.evidence,
        request.source_hash,request.kind,request.red_of_request_id,request.issue_hash,request.issue_count,
        request.issue_watermark,request.provider,request.provider_reference,request.response_hash,
        document.object_ref,document.sha256,document.issued_at,
        coalesce((select jsonb_agg(jsonb_build_object('settlementLine',line.settlement_line_id,'amountMinor',line.amount_minor,
          'taxMinor',line.tax_minor,'sourceHash',line.source_hash) order by line.settlement_line_id)
          from invoice.requestline line where line.request_id=request.id),'[]'::jsonb) lines from invoice.request request
        join invoice.profile profile on profile.id=request.profile_id left join invoice.document document on document.request_id=request.id
        where profile.owner_id=$1 and ($2::timestamptz is null or (request.created_at,request.id)<($2::timestamptz,$3))
        order by request.created_at desc,request.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    invoicesRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const member = await members.member(database.transaction, access.membership.id);
      const result = await database.query(
        `select request.id,request.amount_minor "amountMinor",request.currency,request.state,request.kind,
        request.created_at "createdAt",document.issued_at "issuedAt",document.sha256,(document.object_ref is not null and request.state='issued') downloadable,
        request.version from invoice.request request join invoice.profile profile on profile.id=request.profile_id
        left join invoice.document document on document.request_id=request.id
        where profile.owner_id=$1 and ($2::timestamptz is null or (request.created_at,request.id)<($2::timestamptz,$3))
        order by request.created_at desc,request.id desc limit $4`,
        [member, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'createdAt');
    },
    invoicesDownload: financeLifecycle({
      async execute(request, database) {
        const access = requireAccess(request);
        const member = await members.member(database.transaction, access.membership.id);
        const result = await database.query<{ readonly id: string; readonly object_ref: string; readonly sha256: string }>(
          `select request.id,document.object_ref,document.sha256 from invoice.request request
          join invoice.profile profile on profile.id=request.profile_id
          join invoice.document document on document.request_id=request.id
          where request.id=$1 and profile.owner_id=$2 and request.state='issued'`,
          [request.input.path.invoiceid!, member]
        );
        const invoice = result.rows[0];
        if (!invoice) throw new DomainError('RESOURCE_NOT_FOUND');
        return { status: 200, body: invoice };
      },
      async finalize(_request, result) {
        const invoice = result.body as Readonly<{ id: string; object_ref: string; sha256: string }>;
        const authorization = await objects.authorize(invoice.object_ref, 300);
        return { status: 200, body: { ...authorization, filename: `${safeName(invoice.id)}.pdf`, sha256: invoice.sha256 } };
      },
    }),
  };
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9.-]/g, '-').slice(0, 120) || 'invoice';
}
