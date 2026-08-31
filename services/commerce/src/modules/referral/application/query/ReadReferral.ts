import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { randomUUID } from 'node:crypto';
import { reject, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import type { ReferralToken } from '../../domain/value/ReferralToken';
import type { Clock } from '../port/Clock';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';
import type { ReferralRepository } from '../../domain/repository/ReferralRepository';
import type { CommissionRepository } from '../../domain/repository/CommissionRepository';
import type { WithdrawalRepository } from '../../domain/repository/WithdrawalRepository';
import type { MemberReader } from '../port/MemberReader';

export function referralQueries(
  tokens: ReferralToken,
  clock: Clock,
  members: MemberReader,
  repositories: Readonly<{
    referral(transaction: Transaction): ReferralRepository;
    commissions(transaction: Transaction): CommissionRepository;
    withdrawals(transaction: Transaction): WithdrawalRepository;
  }>
): OperationActions {
  return {
    'referral.settings.read': async (request, database) => rowResult(await repositories.referral(database).setting(requireAccess(request).scope.id)),
    'referral.products.read': async (request, database) => {
      const page = queryPage(request);
      const result = await repositories.referral(database).products(requireAccess(request).scope.id, { cursor: page.id, limit: page.fetch });
      return keysetRows(result.rows, page, 'id');
    },
    'referral.members.read': async (request, database) => {
      const page = queryPage(request);
      const result = await repositories.referral(database).members(requireAccess(request).scope.id, { cursor: page.id, limit: page.fetch });
      return keysetRows(result.rows, page, 'id');
    },
    'referral.bindings.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const member = await members.eligible(database, access.scope.id, access.membership.id);
      const personal = ['owner', 'self'].includes(access.scope.kind);
      if (personal && !member) reject('REFERRAL_NOT_ELIGIBLE');
      const self = personal ? member!.memberId : null;
      const scopeId = self === null ? access.scope.id : member!.scopeId;
      const result = await repositories.referral(database).bindings(scopeId, self, { cursor: page.id, limit: page.fetch });
      return keysetRows(result.rows, page, 'id');
    },
    'referral.commissions.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await repositories.commissions(database).read(access.scope.id, null, page.id, page.fetch);
      return keysetRows(result.rows, page, 'id');
    },
    'referral.earnings.read': async (request, database) => {
      const access = requireAccess(request);
      const member = await members.eligible(database, access.scope.id, access.membership.id);
      if (!member) reject('REFERRAL_NOT_ELIGIBLE');
      return rowResult(await repositories.commissions(database).earnings(member.scopeId, member.memberId));
    },
    'referral.links.read': async (request, database) => {
      const access = requireAccess(request);
      const member = await members.eligible(database, access.scope.id, access.membership.id);
      if (!member) reject('REFERRAL_NOT_ELIGIBLE');
      const active = await database.query<{ id: string; version: number; first_touch_days: number }>(
        `select member.id,setting.version,setting.first_touch_days from referral.member member
        join referral.setting setting on setting.scope_id=member.scope_id and setting.enabled
        where member.scope_id=$1 and member.member_id=$2 and member.state='active'`,
        [member.scopeId, member.memberId]
      );
      const promoter = active.rows[0]?.id;
      if (!promoter) reject('REFERRAL_NOT_ELIGIBLE');
      const product = queryValue(request.input.query.productId);
      const expiresAt = new Date(clock.now().getTime() + Math.min(active.rows[0]!.first_touch_days, 30) * 86_400_000).toISOString();
      const token = tokens.issue({ scopeId: member.scopeId, promoterId: promoter, expiresAt, nonce: randomUUID(), settingVersion: active.rows[0]!.version });
      return { status: 200, body: { token, url: `/referral/${encodeURIComponent(token)}`, expiresAt, productId: product || null } };
    },
    'referral.withdrawals.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const member = await members.eligible(database, access.scope.id, access.membership.id);
      if (!member) reject('REFERRAL_NOT_ELIGIBLE');
      const result = await repositories.withdrawals(database).read(member.scopeId, member.memberId, page.id, page.fetch);
      return keysetRows(result.rows, page, 'id');
    },
  };
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}
