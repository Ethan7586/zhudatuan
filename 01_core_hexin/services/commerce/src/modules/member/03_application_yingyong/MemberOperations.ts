import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { accessPort } from '../../access';
import { addressPort } from '../../checkout_jiesuan';
import { hostedMallOpeningAction } from './HostedMallOpeningOperation';
import { sovereignUpgradeAction } from './SovereignUpgradeOperation';
import { memberImportOperations } from './MemberImportOperations';
import { memberCustomProfileActions } from './MemberCustomProfileOperations';
import { memberOperatorReadActions } from './MemberReadOperations';

export function memberOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const kms = context.container.get(KMS_CLIENT);
  return new ModuleOperations('member', pool, context.container.get(AUDIT_SINK), {
    ...memberImportOperations(context),
    ...memberCustomProfileActions(),
    ...memberOperatorReadActions(),
    'member.profile.read': async (request, database) => {
      const access = requireAccess(request);
      return rowResult(await database.query(`select profile.id,profile.display_name,profile.status,profile.mobile_token is not null mobile_bound,
        membership.id membership_id,membership.organization_id,organization.name organization_name,
        membership.employee_no,membership.joined_at,membership.access_version
        from access.membership membership join member.profile profile on profile.id=membership.member_id
        join organization.organization organization on organization.id=membership.organization_id
        where membership.id=$1 and membership.status='active'`, [access.membership.id]));
    },
    'member.malls.open': hostedMallOpeningAction,
    'member.sovereignty.upgrade': sovereignUpgradeAction,
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
        if (body.isDefault === true && body.recipient === undefined) return { access, body, envelopes: null };
        const recipient = textField(body, 'recipient', 128).trim();
        const mobile = textField(body, 'mobile', 32).trim();
        const address = textField(body, 'address', 1000).trim();
        const region = textField(body, 'region', 64).trim();
        const [recipientEnvelope, mobileEnvelope, addressEnvelope] = await Promise.all([
          kms.encrypt('member/address/recipient', recipient, { principal: access.actor.id }),
          kms.encrypt('member/address/mobile', mobile, { principal: access.actor.id }),
          kms.encrypt('member/address/detail', address, { principal: access.actor.id }),
        ]);
        return { access, body, envelopes: { recipient, mobile, address, region, recipientEnvelope, mobileEnvelope, addressEnvelope } };
      },
      execute: async (request, database, { access, body, envelopes }) => {
        const member = await accessPort.member(database, access.membership.id);
        if (body.status === 'deleted') return rowResult(await addressPort.remove(database, request.input.path.addressid!, member, request.input.expectedVersion ?? null));
        if (body.isDefault === true && !envelopes) {
          const result = await addressPort.setDefault(database, request.input.path.addressid!, member, request.input.expectedVersion ?? null);
          if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
          return rowResult(result);
        }
        if (!envelopes) throw new Error('ADDRESS_ENVELOPE_MISSING');
        const result = await addressPort.save(database, { id: request.input.path.addressid!, member,
          recipient: envelopes.recipient, mobile: envelopes.mobile, address: envelopes.address, region: envelopes.region,
          recipientEnvelope: envelopes.recipientEnvelope, mobileEnvelope: envelopes.mobileEnvelope, addressEnvelope: envelopes.addressEnvelope,
          isDefault: body.isDefault === true,
          expectedVersion: request.input.expectedVersion ?? null });
        if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
        return rowResult(result);
      },
    }),
  });
}
