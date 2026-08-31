import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import { reject, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { CatalogReader } from '../port/CatalogReader';
import type { MemberReader } from '../port/MemberReader';
import type { Identifier } from '../port/Identifier';
import type { Clock } from '../port/Clock';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';
import type { ReferralRepository } from '../../domain/repository/ReferralRepository';
import type { WithdrawalRepository } from '../../domain/repository/WithdrawalRepository';
import { ReferralProduct } from '../../domain/model/ReferralProduct';
import { ReferralSetting } from '../../domain/model/ReferralSetting';
import { ReferralBinding } from '../../domain/model/ReferralBinding';
import { ReferralMember, type ReferralMemberState } from '../../domain/model/ReferralMember';
import { Withdrawal } from '../../domain/model/Withdrawal';
import { AttributionPolicy } from '../../domain/policy/AttributionPolicy';
import { WithdrawalPolicy } from '../../domain/policy/WithdrawalPolicy';
import { ReferralMoney } from '../../domain/value/ReferralMoney';
import type { ReferralToken } from '../../domain/value/ReferralToken';
import { DomainError } from '../../../../foundation/domain/DomainError';

export function referralCommands(
  dependencies: Readonly<{
    members: MemberReader;
    catalog: CatalogReader;
    identifiers: Identifier;
    tokens: ReferralToken;
    clock: Clock;
    referral(transaction: Transaction): ReferralRepository;
    withdrawals(transaction: Transaction): WithdrawalRepository;
  }>
): OperationActions {
  const attribution = new AttributionPolicy();
  const withdrawalPolicy = new WithdrawalPolicy();
  return {
    'referral.settings.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const model = new ReferralSetting(
        request.input.path.settingid!,
        access.scope.id,
        booleanField(body, 'enabled'),
        integerField(body, 'firstTouchDays', 1),
        integerField(body, 'rateBasisPoints'),
        BigInt(integerField(body, 'minimumWithdrawalMinor')),
        textField(body, 'currency', 3),
        expected(request)
      );
      const result = await dependencies.referral(database).manageSetting({
        id: model.id,
        scopeId: model.scopeId,
        enabled: model.enabled,
        firstTouchDays: model.firstTouchDays,
        rateBasisPoints: model.rate.basisPoints,
        minimumWithdrawalMinor: Number(model.minimumWithdrawalMinor),
        currency: model.currency,
        expectedVersion: model.version,
      });
      if (!result.rows[0]) reject('VERSION_CONFLICT');
      return rowResult(result);
    },
    'referral.products.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const productId = request.input.path.productid!;
      const source = await dependencies.catalog.product(access.scope.id, productId);
      if (!source?.active) reject('REFERRAL_PRODUCT_DISABLED');
      const model = new ReferralProduct(productId, access.scope.id, productId, booleanField(body, 'enabled'), integerField(body, 'rateBasisPoints'), expected(request));
      const result = await dependencies.referral(database).manageProduct({ id: model.id, scopeId: model.scopeId, productId: model.productId, enabled: model.enabled, rateBasisPoints: model.rate.basisPoints, expectedVersion: model.version });
      if (!result.rows[0]) reject('VERSION_CONFLICT');
      return rowResult(result);
    },
    'referral.members.apply': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const member = await dependencies.members.eligible(database, access.scope.id, access.membership.id);
      if (!member) reject('REFERRAL_NOT_ELIGIBLE');
      const model = new ReferralMember(dependencies.identifiers.next('referralmember'), member.scopeId, member.memberId, 'applied', 1, access.actor.id);
      const result = await dependencies.referral(database).applyMember({
        id: model.id,
        scopeId: member.scopeId,
        memberId: member.memberId,
        displayName: textField(body, 'displayName'),
        mobile: textField(body, 'mobile', 20),
        makerId: access.actor.id,
        reason: textField(body, 'reason', 500),
      });
      if (!result.rows[0]) reject('REFERRAL_NOT_ELIGIBLE');
      return rowResult(result, 201);
    },
    'referral.members.approve': decide('active', dependencies.referral),
    'referral.members.disqualify': decide('disqualified', dependencies.referral),
    'referral.bindings.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const raw = textField(body, 'token', 2048);
      const member = await dependencies.members.eligible(database, access.scope.id, access.membership.id);
      if (!member) reject('REFERRAL_NOT_ELIGIBLE');
      const claims = dependencies.tokens.verify(raw, member.scopeId, dependencies.clock.now());
      const setting = await dependencies.referral(database).setting(member.scopeId);
      const current = setting.rows[0] as { enabled?: boolean; version?: number } | undefined;
      if (!current?.enabled || current.version !== claims.settingVersion) reject('REFERRAL_INVALID_TOKEN');
      const now = dependencies.clock.now().toISOString();
      const candidate = new ReferralBinding(dependencies.identifiers.next('referralbinding'), member.scopeId, member.memberId, claims.promoterId, dependencies.tokens.fingerprint(raw), now, 1);
      const existingResult = await dependencies.referral(database).binding(member.scopeId, member.memberId);
      const existing = existingResult.rows[0] ? bindingModel(existingResult.rows[0]) : undefined;
      if (attribution.choose(existing, candidate) !== candidate) reject('REFERRAL_ALREADY_BOUND');
      const result = await dependencies.referral(database).bind({
        id: candidate.id,
        scopeId: candidate.scopeId,
        customerId: candidate.customerId,
        promoterId: candidate.promoterId,
        fingerprint: candidate.tokenFingerprint,
        source: textField(body, 'source', 100),
      });
      if (!result.rows[0]) reject('REFERRAL_ALREADY_BOUND');
      return rowResult(result, 201);
    },
    'referral.withdrawals.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const member = await dependencies.members.eligible(database, access.scope.id, access.membership.id);
      if (!member) reject('REFERRAL_NOT_ELIGIBLE');
      const amount = integerField(body, 'amountMinor', 1);
      const currency = textField(body, 'currency', 3);
      const accountRef = textField(body, 'accountRef');
      const positionResult = await dependencies.withdrawals(database).position(member.scopeId, member.memberId);
      const position = positionResult.rows[0] as
        | Readonly<{
            availableMinor?: string | number;
            hasPendingReversal?: boolean;
            minimumMinor?: string | number;
            currency?: string;
            version?: string | number;
          }>
        | undefined;
      if (!position?.currency) reject('REFERRAL_WITHDRAWAL_CONFLICT');
      const money = new ReferralMoney(BigInt(amount), currency);
      withdrawalPolicy.assertRequest(money, new ReferralMoney(BigInt(position.availableMinor ?? 0), position.currency), BigInt(position.minimumMinor ?? 0), position.hasPendingReversal === true);
      const model = new Withdrawal(dependencies.identifiers.next('referralwithdrawal'), member.scopeId, member.memberId, money.amountMinor, money.currency, accountRef, 'requested', 1);
      if (Number(position.version) !== expected(request)) reject('REFERRAL_WITHDRAWAL_CONFLICT');
      const result = await dependencies.withdrawals(database).create({
        id: model.id,
        scopeId: model.scopeId,
        memberId: model.memberId,
        amountMinor: Number(model.money.amountMinor),
        currency: model.money.currency,
        accountRef: model.accountRef,
        expectedVersion: expected(request),
      });
      if (!result.rows[0]) reject('REFERRAL_WITHDRAWAL_CONFLICT');
      return rowResult(result, 201);
    },
  };
}

function decide(next: 'active' | 'disqualified', repository: (transaction: Transaction) => ReferralRepository): NonNullable<OperationActions['referral.members.approve']> {
  return async (request, database) => {
    const access = requireAccess(request);
    const source = await repository(database).member(access.scope.id, request.input.path.memberid!);
    const row = source.rows[0] as Readonly<{ id?: string; scopeId?: string; memberId?: string; state?: ReferralMemberState; version?: number; makerId?: string }> | undefined;
    if (!row?.id || !row.scopeId || !row.memberId || !row.state || !row.makerId || row.version !== expected(request)) reject('VERSION_CONFLICT');
    const current = new ReferralMember(row.id, row.scopeId, row.memberId, row.state, row.version, row.makerId);
    const decided = next === 'active' ? current.approve(access.actor.id) : current.disqualify(access.actor.id);
    const result = await repository(database).decideMember({
      id: decided.id,
      scopeId: access.scope.id,
      actorId: access.actor.id,
      expectedVersion: current.version,
      next: decided.state as 'active' | 'disqualified',
      reason: textField(bodyRecord(request), 'reason', 500),
    });
    if (!result.rows[0]) reject('VERSION_CONFLICT');
    return rowResult(result);
  };
}

function bindingModel(row: Readonly<Record<string, unknown>>): ReferralBinding {
  return new ReferralBinding(
    String(row.id ?? ''),
    String(row.scopeId ?? ''),
    String(row.customerId ?? ''),
    String(row.promoterId ?? ''),
    String(row.tokenFingerprint ?? ''),
    new Date(String(row.boundAt ?? '')).toISOString(),
    Number(row.version)
  );
}

function expected(request: OperationRequest): number {
  if (!Number.isSafeInteger(request.input.expectedVersion) || request.input.expectedVersion! < 1) reject('VERSION_CONFLICT');
  return request.input.expectedVersion!;
}

function booleanField(body: Readonly<Record<string, unknown>>, field: string): boolean {
  const value = body[field];
  if (typeof value !== 'boolean') throw new DomainError('VALIDATION_FAILED', { field });
  return value;
}
