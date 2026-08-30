import type { ConsoleSession } from '../../entity/session/ConsoleSession';
import type { TransferConfiguration as TransferCommandConfiguration } from './OwnerTransferQuery';
import type {
  OwnerTransferAcceptPreview,
  OwnerTransferPreview,
  OwnershipState,
} from './OwnerTransferSchema';

export type TransferAction = 'create' | 'accept' | 'cancel';

export interface MobileEnrollmentFlow {
  readonly stage: 'password' | 'entry' | 'verify' | 'binding' | 'relogin';
  readonly password: string;
  readonly mobile: string;
  readonly maskedMobile?: string | undefined;
  readonly challenge?: Readonly<{ id: string; expiresAt: string }> | undefined;
  readonly code: string;
  readonly error?: string | undefined;
}

export interface TransferFlow {
  readonly action: TransferAction;
  readonly targetMembership: string;
  readonly formerOwnerMode: 'retain_admin' | 'remove_admin';
  readonly formerOwnerRole: string;
  readonly reason: string;
  readonly challenge?: Readonly<{ id: string; expiresAt: string }> | undefined;
  readonly code: string;
  readonly preview?: OwnerTransferPreview | OwnerTransferAcceptPreview | undefined;
  readonly elevatedSession?: ConsoleSession | undefined;
  readonly confirmed: boolean;
  readonly error?: string | undefined;
}

export const REQUIRED_READ = 'access.ownership.read';
export const MOBILE_MANAGE = 'identity.mobile.manage';
const MAINLAND_MOBILE = /^1[3-9][0-9]{9}$/;
const STEP_UP_CAPABILITIES = ['identity.stepup.start', 'identity.stepup.complete'] as const;
const ACTION_CAPABILITIES: Readonly<Record<TransferAction, readonly string[]>> = Object.freeze({
  create: ['access.ownership.transfers.preview', 'access.ownership.transfers.create'],
  accept: ['access.ownership.transfers.accept.preview', 'access.ownership.transfers.accept'],
  cancel: ['access.ownership.transfers.cancel.preview', 'access.ownership.transfers.cancel'],
});

export function configuration(flow: TransferFlow): TransferCommandConfiguration {
  return {
    targetMembership: flow.targetMembership,
    formerOwnerMode: flow.formerOwnerMode,
    ...(flow.formerOwnerMode === 'retain_admin' ? { formerOwnerRole: flow.formerOwnerRole } : {}),
  };
}

export function flowReadyForStepUp(flow: TransferFlow, ownership: OwnershipState | undefined): boolean {
  if (ownership === undefined || !ownership.mobileReady) return false;
  if (flow.action === 'cancel') return flow.reason.trim().length >= 8 && ownership.pending !== null;
  if (flow.action === 'accept') return ownership.pending?.targetMembership === flow.targetMembership;
  if (!ownership.candidates.some(({ membership, mobileReady }) => membership === flow.targetMembership && mobileReady)) return false;
  return flow.formerOwnerMode === 'remove_admin'
    || ownership.formerOwnerRoles.some(({ id }) => id === flow.formerOwnerRole);
}

export function capabilitiesReady(session: ConsoleSession, action: TransferAction): boolean {
  return [...STEP_UP_CAPABILITIES, ...ACTION_CAPABILITIES[action]].every((capability) => session.capabilities.includes(capability));
}

export function mainlandMobileValid(value: string): boolean {
  return MAINLAND_MOBILE.test(value);
}

export function mainlandMobileInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function maskMainlandMobile(value: string): string {
  return mainlandMobileValid(value) ? `+86 ${value.slice(0, 3)}****${value.slice(-4)}` : '已验证手机号';
}

export function snapshotMatches(ownership: OwnershipState, flow: TransferFlow): boolean {
  const preview = flow.preview;
  const session = flow.elevatedSession;
  if (preview === undefined || session === undefined || session.assurance.level < 3
    || ownership.owner === null || preview.sourceMembership !== ownership.owner.membership
    || ownership.version !== preview.ownershipVersion || preview.targetMembership !== flow.targetMembership) return false;
  if (flow.action === 'create') {
    const candidate = ownership.candidates.find(({ membership }) => membership === flow.targetMembership);
    return !('transferVersion' in preview) && ownership.pending === null && candidate?.accessVersion === preview.targetAccessVersion
      && session.membership === preview.sourceMembership;
  }
  if (!('transferVersion' in preview) || ownership.pending?.version !== preview.transferVersion) return false;
  return flow.action === 'accept' ? session.membership === preview.targetMembership : session.membership === preview.sourceMembership;
}

export function proofExpired(value: string): boolean {
  const expires = new Date(value).getTime();
  return !Number.isFinite(expires) || expires <= Date.now();
}

export function formerOwnerLabel(mode: 'retain_admin' | 'remove_admin'): string {
  return mode === 'retain_admin' ? '卸下 Owner，保留所选管理员角色' : '卸下 Owner，同时移除后台管理员身份';
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '无效时间' : date.toLocaleString('zh-CN', { hour12: false });
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) return '时间不可验证';
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}
