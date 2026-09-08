import { createHash, randomUUID } from 'node:crypto';
import type { OperationId, OperationInputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { HandlerContext, WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import { bodyRecord, integerField, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { OwnershipTransfer, type FormerOwnerMode } from '../../domain/model/OwnershipTransfer';
import { OwnershipPolicy } from '../../domain/policy/OwnershipPolicy';
import type { OwnershipImpact, OwnershipRepository, OwnershipTransferView, OwnershipView } from '../port/OwnershipRepository';

export interface OwnershipPreview extends OwnershipImpact {
  readonly state: 'draft';
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole: string | null;
  readonly coolingUntil: string;
  readonly expiresAt: string;
}

export class ManageOwnershipTransfer {
  private readonly policy = new OwnershipPolicy();

  constructor(
    private readonly repository: OwnershipRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async read(input: OperationInputFor<'access.ownership.read'>, context: HandlerContext<'access.ownership.read'>): Promise<OwnershipView> {
    void input;
    const access = requireSession(context.security);
    const view = await this.repository.read(context.transaction, ownershipScope(access), access.membership.id);
    if (!view) throw new DomainError('RESOURCE_NOT_FOUND');
    return view;
  }

  async previewCreate<TKey extends 'access.ownership.transfers.preview' | 'access.ownership.transfers.create'>(input: OperationInputFor<TKey>, context: WriteHandlerContext<TKey>): Promise<OwnershipPreview> {
    const prepared = await this.prepareCreate(input, context);
    return prepared.preview;
  }

  async create(input: OperationInputFor<'access.ownership.transfers.create'>, context: WriteHandlerContext<'access.ownership.transfers.create'>): Promise<OwnershipTransferView> {
    const prepared = await this.prepareCreate(input, context);
    const proof = proofHash(context.actionProof);
    const transfer = prepared.transfer.submit(proof);
    const created = await this.repository.create(context.transaction, transfer, prepared.reason, prepared.actor, context.traceId);
    if (!created) throw new DomainError('OWNER_TRANSFER_PENDING');
    return created;
  }

  async previewAccept<TKey extends 'access.ownership.transfers.accept.preview' | 'access.ownership.transfers.accept'>(
    input: OperationInputFor<TKey>,
    context: WriteHandlerContext<TKey>
  ): Promise<Readonly<{ transfer: OwnershipTransferView; impact: OwnershipImpact }>> {
    const prepared = await this.prepareExisting(input.path.transferid, context, 'accept');
    return Object.freeze({ transfer: transferView(prepared.transfer), impact: prepared.impact });
  }

  async accept(input: OperationInputFor<'access.ownership.transfers.accept'>, context: WriteHandlerContext<'access.ownership.transfers.accept'>): Promise<Readonly<{ ownership: OwnershipView; transfer: OwnershipTransferView }>> {
    const prepared = await this.prepareExisting(input.path.transferid, context, 'accept');
    const changed = prepared.transfer.accept(prepared.actor, proofHash(context.actionProof), this.now());
    const result = await this.repository.accept(context.transaction, changed, prepared.actor);
    if (!result) throw new DomainError('VERSION_CONFLICT');
    return result;
  }

  async previewCancel<TKey extends 'access.ownership.transfers.cancel.preview' | 'access.ownership.transfers.cancel'>(
    input: OperationInputFor<TKey>,
    context: WriteHandlerContext<TKey>
  ): Promise<Readonly<{ transfer: OwnershipTransferView; impact: OwnershipImpact; reason: string }>> {
    const reason = reasonFrom(input);
    const prepared = await this.prepareExisting(input.path.transferid, context, 'cancel');
    return Object.freeze({ transfer: transferView(prepared.transfer), impact: prepared.impact, reason });
  }

  async cancel(input: OperationInputFor<'access.ownership.transfers.cancel'>, context: WriteHandlerContext<'access.ownership.transfers.cancel'>): Promise<OwnershipTransferView> {
    const reason = reasonFrom(input);
    const prepared = await this.prepareExisting(input.path.transferid, context, 'cancel');
    const changed = prepared.transfer.cancel(prepared.actor, proofHash(context.actionProof), this.now());
    const result = await this.repository.cancel(context.transaction, changed, reason, prepared.actor);
    if (!result) throw new DomainError('VERSION_CONFLICT');
    return result;
  }

  private async prepareCreate<TKey extends 'access.ownership.transfers.preview' | 'access.ownership.transfers.create'>(input: OperationInputFor<TKey>, context: WriteHandlerContext<TKey>) {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const target = textField(body, 'targetMembership');
    const targetVersion = integerField(body, 'targetAccessVersion', 1);
    const mode = ownerMode(textField(body, 'formerOwnerMode'));
    const formerRole = optionalText(body.formerOwnerRole);
    const reason = textField(body, 'reason', 500).trim();
    if (reason.length < 4) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
    const scope = ownershipScope(access);
    const ownership = await this.repository.lockOwnership(context.transaction, scope);
    if (!ownership) throw new DomainError('RESOURCE_NOT_FOUND');
    const members = await this.repository.lockMembers(context.transaction, [ownership.membership, target].sort());
    const source = members.find((membership) => membership.id === ownership.membership);
    const candidate = members.find((membership) => membership.id === target);
    if (!source || !candidate) throw new DomainError('RESOURCE_NOT_FOUND');
    const expectedVersion = requiredVersion(context.expectedVersion);
    this.policy.assertDraft({ actor: access.membership.id, source, target: candidate, ownership, expectedVersion, targetVersion, mode, formerRole });
    if (await this.repository.activeTransfer(context.transaction, scope, context.traceId)) throw new DomainError('OWNER_TRANSFER_PENDING');
    const formerOwnerRoleVersion = await this.repository.roleVersion(context.transaction, formerRole, scope);
    if (formerRole !== null && formerOwnerRoleVersion === null) throw new DomainError('OWNER_TRANSFER_ROLE_INVALID');
    const impact = await this.repository.impact(context.transaction, scope, [ownership.membership, target]);
    const started = this.now().getTime();
    const coolingUntil = new Date(started + 24 * 60 * 60_000);
    const expiresAt = new Date(started + 7 * 24 * 60 * 60_000);
    const transfer = new OwnershipTransfer({
      id: `ownershiptransfer:${randomUUID()}`,
      scope: ownership.scope,
      role: ownership.role,
      sourceMembership: ownership.membership,
      targetMembership: target,
      formerOwnerMode: mode,
      formerOwnerRole: formerRole,
      formerOwnerRoleVersion,
      ownershipVersion: ownership.version,
      targetAccessVersion: targetVersion,
      sourceProof: null,
      targetProof: null,
      cancelProof: null,
      state: 'draft',
      version: 1,
      coolingUntil,
      expiresAt,
    });
    const preview: OwnershipPreview = Object.freeze({
      state: 'draft',
      sourceMembership: ownership.membership,
      targetMembership: target,
      ownershipVersion: ownership.version,
      targetAccessVersion: targetVersion,
      formerOwnerRoleVersion,
      formerOwnerMode: mode,
      formerOwnerRole: formerRole,
      affectedPeople: impact.people,
      affectedScopes: impact.scopes,
      warnings: ['接受前原所有者仍保持权限', '24 小时冷静期结束后才可接受', '接受后双方权限版本立即递增', mode === 'remove_admin' ? '原所有者将移除后台管理员身份' : '原所有者将保留所选管理员角色'],
      coolingUntil: coolingUntil.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    return Object.freeze({ transfer, preview, reason, actor: access.membership.id });
  }

  private async prepareExisting<TKey extends OperationId>(transferId: string, context: WriteHandlerContext<TKey>, action: 'accept' | 'cancel') {
    const access = requireSession(context.security);
    const scope = ownershipScope(access);
    const transfer = await this.repository.lockTransfer(context.transaction, scope, transferId);
    if (!transfer) throw new DomainError('RESOURCE_NOT_FOUND');
    const active = transfer.current(this.now());
    if (active.state === 'expired') throw new DomainError('OWNER_TRANSFER_EXPIRED');
    const ownership = await this.repository.lockOwnership(context.transaction, scope);
    if (!ownership) throw new DomainError('RESOURCE_NOT_FOUND');
    if (action === 'accept') {
      if (this.now() < active.coolingUntil) throw new DomainError('OWNER_TRANSFER_COOLING_PERIOD');
      const [actor] = await this.repository.lockMembers(context.transaction, [access.membership.id]);
      if (!actor) throw new DomainError('RESOURCE_NOT_FOUND');
      this.policy.assertAccept(active, actor, ownership, requiredVersion(context.expectedVersion));
    } else {
      this.policy.assertCancel(active, access.membership.id, requiredVersion(context.expectedVersion));
    }
    const impact = await this.repository.impact(context.transaction, active.scope, [active.sourceMembership, active.targetMembership]);
    return Object.freeze({
      transfer: active,
      actor: access.membership.id,
      impact: Object.freeze({
        sourceMembership: active.sourceMembership,
        targetMembership: active.targetMembership,
        ownershipVersion: active.ownershipVersion,
        targetAccessVersion: active.targetAccessVersion,
        formerOwnerRoleVersion: await this.repository.roleVersion(context.transaction, active.formerOwnerRole, active.scope),
        affectedPeople: impact.people,
        affectedScopes: impact.scopes,
        warnings: action === 'accept' ? ['接受后所有权立即切换', '旧会话将在权限版本更新后失效'] : ['取消后当前所有者保持不变'],
      }),
    });
  }
}

function ownershipScope(access: Readonly<{ organization: string; scope: Readonly<{ tenant?: string }> }>): string {
  return access.scope.tenant ?? access.organization;
}

function ownerMode(value: string): FormerOwnerMode {
  if (value !== 'retain_admin' && value !== 'remove_admin') throw new DomainError('OWNER_TRANSFER_ROLE_INVALID');
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredVersion(value: number | undefined): number {
  if (value === undefined) throw new DomainError('VERSION_CONFLICT');
  return value;
}

function proofHash(value: string | undefined): string {
  if (!value) throw new DomainError('ACTION_PROOF_REQUIRED');
  return createHash('sha256').update(value).digest('hex');
}

function reasonFrom(input: Readonly<{ body?: unknown }>): string {
  const reason = textField(bodyRecord(input), 'reason', 500).trim();
  if (reason.length < 4) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
  return reason;
}

export function transferView(transfer: OwnershipTransfer): OwnershipTransferView {
  return Object.freeze({
    id: transfer.id,
    state: transfer.state,
    sourceMembership: transfer.sourceMembership,
    targetMembership: transfer.targetMembership,
    targetMember: transfer.targetMembership,
    targetPrincipal: transfer.targetMembership,
    targetDisplayName: transfer.targetMembership,
    formerOwnerMode: transfer.formerOwnerMode,
    formerOwnerRole: transfer.formerOwnerRole,
    formerOwnerRoleVersion: transfer.formerOwnerRoleVersion,
    coolingUntil: transfer.coolingUntil.toISOString(),
    expiresAt: transfer.expiresAt.toISOString(),
    version: transfer.version,
  });
}
