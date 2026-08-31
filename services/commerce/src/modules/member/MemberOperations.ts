import { DomainError } from '../../foundation/domain/DomainError';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, keysetRows, queryPage, textField } from '../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { memberImportOperations } from './application/MemberImportOperations';
import { MEMBER_ACCESS_PORT } from '../access/public/index';
import { MEMBER_ADDRESS_PORT } from '../checkout/public/index';
import { MEMBER_CATALOG_PORT } from '../catalog/public';

export function memberOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const kms = context.service(KMS_CLIENT);
  const accessPort = context.ports.get(MEMBER_ACCESS_PORT);
  const addressPort = context.ports.get(MEMBER_ADDRESS_PORT);
  const catalogPort = context.ports.get(MEMBER_CATALOG_PORT);
  return new ModuleOperations('member', pool, context.service(AUDIT_SINK), {
    ...memberImportOperations(context),
    'member.members.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const memberships = await accessPort.members(database, access.scope.id, page.id, page.fetch);
      const profiles =
        memberships.length === 0
          ? []
          : (
              await database.query<{ id: string; display_name: string; status: string }>(
                `select id,display_name,status
        from member.profile where id=any($1::text[])`,
                [[...new Set(memberships.map((membership) => membership.member))]]
              )
            ).rows;
      const byMember = new Map(profiles.map((profile) => [profile.id, profile]));
      const rows = memberships.flatMap((membership) => {
        const profile = byMember.get(membership.member);
        return profile
          ? [
              Object.freeze({
                id: profile.id,
                display_name: profile.display_name,
                status: profile.status,
                membership_id: membership.id,
                employee_no: membership.employee,
                membership_status: membership.status,
                access_version: membership.accessversion,
                joined_at: membership.joinedat,
              }),
            ]
          : [];
      });
      return keysetRows(rows, page, 'membership_id', 'membership_id');
    },
    'member.profile.read': async (request, database) => {
      const access = requireAccess(request);
      const membership = await accessPort.profile(database, access.membership.id);
      const profile = await database.query(`select id,display_name,status,mobile_token is not null mobile_bound from member.profile where id=$1`, [membership.member]);
      const row = profile.rows[0];
      if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
      return { status: 200, body: { ...row, membership_id: membership.id, organization_id: membership.organization, employee_no: membership.employee, joined_at: membership.joinedat, access_version: membership.accessversion } };
    },
    'member.favorites.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 100);
      const membership = await accessPort.profile(database, access.membership.id);
      const result = await database.query(
        `select listing_id "listingId",created_at "createdAt" from member.favorite
        where member_id=$1 and ($2::timestamptz is null or (created_at,listing_id)<($2::timestamptz,$3))
        order by created_at desc,listing_id desc limit $4`,
        [membership.member, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'createdAt', 'listingId');
    },
    'member.favorites.put': async (request, database) => {
      const access = requireAccess(request);
      const listing = request.input.path.listingid!;
      const favorite = bodyRecord(request).favorite;
      if (typeof favorite !== 'boolean') throw new DomainError('VALIDATION_FAILED', { field: 'favorite' });
      const membership = await accessPort.profile(database, access.membership.id);
      if (favorite && !(await catalogPort.published(database, listing, membership.organization))) throw new DomainError('RESOURCE_NOT_FOUND');
      if (!favorite) {
        await database.query('delete from member.favorite where member_id=$1 and listing_id=$2', [membership.member, listing]);
        return { status: 200, body: { listingId: listing, favorite: false, createdAt: null } };
      }
      const result = await database.query<{ listingId: string; createdAt: Date }>(
        `with inserted as (
          insert into member.favorite(member_id,listing_id,created_at) values($1,$2,clock_timestamp())
          on conflict(member_id,listing_id) do nothing
          returning listing_id,created_at
        )
        select listing_id "listingId",created_at "createdAt" from inserted
        union all
        select favorite.listing_id "listingId",favorite.created_at "createdAt" from member.favorite favorite
        where favorite.member_id=$1 and favorite.listing_id=$2 and not exists(select 1 from inserted)
        limit 1`,
        [membership.member, listing]
      );
      return { status: 200, body: { ...result.rows[0]!, favorite: true } };
    },
    'member.addresses.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 100);
      const member = await accessPort.member(database, access.membership.id);
      const result = await addressPort.list(database, member, page.id, page.fetch);
      return keysetResult(result, page, 'id');
    },
    'member.addresses.manage': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        if (body.status === 'deleted') return { access, body, envelopes: null };
        const recipient = textField(body, 'recipient', 128).trim();
        const mobile = textField(body, 'mobile', 32).trim();
        const address = textField(body, 'address', 1000).trim();
        const region = textField(body, 'region', 64).trim();
        const [recipientEnvelope, mobileEnvelope, addressEnvelope] = await Promise.all([
          kms.encrypt('pii', 'member/address/recipient', recipient, { principal: access.actor.id }),
          kms.encrypt('pii', 'member/address/mobile', mobile, { principal: access.actor.id }),
          kms.encrypt('pii', 'member/address/detail', address, { principal: access.actor.id }),
        ]);
        return { access, body, envelopes: { recipient, mobile, address, region, recipientEnvelope, mobileEnvelope, addressEnvelope } };
      },
      execute: async (request, database, { access, body, envelopes }) => {
        const member = await accessPort.member(database, access.membership.id);
        if (body.status === 'deleted') return rowResult(await addressPort.remove(database, request.input.path.addressid!, member, request.input.expectedVersion ?? null));
        if (!envelopes) throw new Error('ADDRESS_ENVELOPE_MISSING');
        const result = await addressPort.save(database, {
          id: request.input.path.addressid!,
          member,
          recipient: envelopes.recipient,
          mobile: envelopes.mobile,
          address: envelopes.address,
          region: envelopes.region,
          recipientEnvelope: envelopes.recipientEnvelope,
          mobileEnvelope: envelopes.mobileEnvelope,
          addressEnvelope: envelopes.addressEnvelope,
          expectedVersion: request.input.expectedVersion ?? null,
        });
        if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
        return rowResult(result);
      },
    }),
  });
}
