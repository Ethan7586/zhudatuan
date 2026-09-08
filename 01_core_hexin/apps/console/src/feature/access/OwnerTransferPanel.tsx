import { Button } from '@shop/design';
import { ApiError } from '@shop/sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ConsoleContext, ConsoleSession } from '../../entity/session/ConsoleSession';
import { appConfig } from '../../shared/config/AppConfig';
import { AcceptedDialog, TransferDialog } from './OwnerTransferDialog';
import { OwnerTransferMobileEnrollment } from './OwnerTransferMobileEnrollment';
import {
  configuration,
  flowReadyForStepUp,
  maskMainlandMobile,
  MOBILE_MANAGE,
  proofExpired,
  REQUIRED_READ,
  snapshotMatches,
  type MobileEnrollmentFlow,
  type TransferFlow,
} from './OwnerTransferModel';
import {
  acceptTransfer,
  bindCanonicalMobile,
  cancelTransfer,
  completeStepUpAndReadSession,
  createTransfer,
  ownershipKey,
  previewAccept,
  previewCancel,
  previewTransfer,
  readOwnership,
  requestCanonicalMobileChallenge,
  requestStepUp,
  verifyPasswordForMobileEnrollment,
} from './OwnerTransferQuery';
import type { OwnershipState } from './OwnerTransferSchema';
import { Boundary, OwnerState } from './OwnerTransferState';

export function OwnerTransferPanel({ context }: Readonly<{ context: ConsoleContext }>) {
  const queryClient = useQueryClient();
  const canRead = context.session.capabilities.includes(REQUIRED_READ);
  const query = useQuery({
    queryKey: ownershipKey(context),
    queryFn: ({ signal }) => readOwnership(context, signal),
    enabled: canRead,
    staleTime: 10_000,
  });
  const [flow, setFlow] = useState<TransferFlow>();
  const [enrollment, setEnrollment] = useState<MobileEnrollmentFlow | undefined>(() =>
    !canRead && context.session.security?.phoneMasked === null ? initialEnrollment() : undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [accepted, setAccepted] = useState(false);
  const ownership = query.data;
  const canManageMobile = ['identity.password.verify', 'identity.mobile.challenge', MOBILE_MANAGE]
    .every((capability) => context.session.capabilities.includes(capability));
  const isOwner = ownership?.owner?.membership === context.session.membership;
  const isTarget = ownership?.pending?.targetMembership === context.session.membership;

  const openCreate = () => {
    const candidate = ownership?.candidates.find(({ mobileReady }) => mobileReady);
    const role = ownership?.formerOwnerRoles[0];
    if (candidate === undefined) return;
    setNotice(undefined);
    setFlow({ action: 'create', targetMembership: candidate.membership,
      formerOwnerMode: role === undefined ? 'remove_admin' : 'retain_admin',
      formerOwnerRole: role?.id ?? '', reason: '', code: '', confirmed: false });
    setEnrollment(ownership?.mobileReady === false ? initialEnrollment() : undefined);
  };
  const openAccept = () => {
    const pending = ownership?.pending;
    if (pending === undefined || pending === null) return;
    setNotice(undefined);
    setFlow({ action: 'accept', targetMembership: pending.targetMembership, formerOwnerMode: pending.formerOwnerMode,
      formerOwnerRole: pending.formerOwnerRole ?? '', reason: '', code: '', confirmed: false });
    setEnrollment(ownership?.mobileReady === false ? initialEnrollment() : undefined);
  };
  const openCancel = () => {
    const pending = ownership?.pending;
    if (pending === undefined || pending === null) return;
    setNotice(undefined);
    setFlow({ action: 'cancel', targetMembership: pending.targetMembership, formerOwnerMode: pending.formerOwnerMode,
      formerOwnerRole: pending.formerOwnerRole ?? '', reason: '', code: '', confirmed: false });
    setEnrollment(ownership?.mobileReady === false ? initialEnrollment() : undefined);
  };
  const closeFlow = () => { if (!busy) { setFlow(undefined); setEnrollment(undefined); } };

  const beginStepUp = async () => {
    if (flow === undefined || ownership === undefined) return;
    if (!ownership.mobileReady) { setEnrollment(initialEnrollment()); return; }
    if (!flowReadyForStepUp(flow, ownership)) return;
    setBusy(true);
    setFlow((current) => current === undefined ? current : { ...current, error: undefined });
    try {
      const challenge = await requestStepUp(context.session);
      setFlow((current) => current === undefined ? current : { ...current,
        challenge: { id: challenge.id, expiresAt: challenge.expires_at }, code: '', preview: undefined,
        elevatedSession: undefined, confirmed: false, error: undefined });
    } catch (cause) {
      setFlow((current) => current === undefined ? current : { ...current, error: commandError(cause) });
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollmentPassword = async () => {
    if (enrollment?.stage !== 'password' || enrollment.password.length === 0) return;
    const password = enrollment.password;
    setBusy(true);
    try {
      await verifyPasswordForMobileEnrollment(context.session, password);
      setEnrollment((current) => current === undefined ? current : { ...current, stage: 'entry', password: '', error: undefined });
    } catch (cause) {
      setEnrollment((current) => current === undefined ? current : { ...current, password: '', error: commandError(cause) });
    } finally {
      setBusy(false);
    }
  };

  const requestEnrollmentCode = async () => {
    if (enrollment?.stage !== 'entry') return;
    setBusy(true);
    try {
      const challenge = await requestCanonicalMobileChallenge(context.session, enrollment.mobile);
      setEnrollment((current) => current === undefined ? current : { ...current, stage: 'verify', password: '',
        maskedMobile: maskMainlandMobile(current.mobile), challenge: { id: challenge.id, expiresAt: challenge.expires_at },
        code: '', error: undefined });
    } catch (cause) {
      setEnrollment((current) => current === undefined ? current : { ...current, error: commandError(cause) });
    } finally {
      setBusy(false);
    }
  };

  const bindEnrollmentMobile = async () => {
    if (enrollment?.stage !== 'verify' || enrollment.challenge === undefined || !/^\d{6}$/.test(enrollment.code)) return;
    const { mobile, challenge, code, maskedMobile } = enrollment;
    setBusy(true);
    setEnrollment((current) => current === undefined ? current : { ...current, stage: 'binding', password: '', error: undefined });
    try {
      await bindCanonicalMobile(context.session, mobile, challenge.id, code);
      setEnrollment({ stage: 'relogin', password: '', mobile: '', maskedMobile, code: '' });
    } catch (cause) {
      setEnrollment((current) => current === undefined ? current : { ...current, stage: 'verify', password: '', code: '',
        error: commandError(cause) });
    } finally {
      setBusy(false);
    }
  };

  const verifyAndPreview = async () => {
    if (flow === undefined || flow.challenge === undefined || !/^\d{6}$/.test(flow.code) || ownership === undefined) return;
    setBusy(true);
    setFlow((current) => current === undefined ? current : { ...current, error: undefined });
    try {
      const session = await completeStepUpAndReadSession(context.session, flow.challenge.id, flow.code);
      const preview = await createPreview(context, session, ownership, flow);
      setFlow((current) => current === undefined ? current : { ...current, preview, elevatedSession: session,
        confirmed: false, error: undefined });
    } catch (cause) {
      if (isConflict(cause)) await discardStalePreview(query, setFlow);
      else setFlow((current) => current === undefined ? current : { ...current, error: commandError(cause) });
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (flow === undefined || ownership === undefined || !flow.confirmed
      || flow.preview === undefined || flow.elevatedSession === undefined || proofExpired(flow.preview.proofExpiresAt)
      || !snapshotMatches(ownership, flow)) return;
    setBusy(true);
    setFlow((current) => current === undefined ? current : { ...current, error: undefined });
    try {
      if (flow.action === 'create') {
        await createTransfer(context, flow.elevatedSession, configuration(flow), flow.preview.ownershipVersion, flow.preview.proof);
        setFlow(undefined);
        setNotice('Owner 转让已发起，只有指定接任人完成本人短信 Step-Up 后才会同步交换 Owner。');
        await queryClient.invalidateQueries({ queryKey: ['console'] });
      } else if (flow.action === 'accept') {
        if (!('transferVersion' in flow.preview) || ownership.pending === null) throw new Error('OWNER_TRANSFER_PREVIEW_INVALID');
        await acceptTransfer(context, flow.elevatedSession, ownership.pending.id, flow.preview.transferVersion, flow.preview.proof);
        queryClient.clear();
        setFlow(undefined);
        setAccepted(true);
      } else {
        if (!('transferVersion' in flow.preview) || ownership.pending === null) throw new Error('OWNER_TRANSFER_PREVIEW_INVALID');
        await cancelTransfer(context, flow.elevatedSession, ownership.pending.id, flow.preview.transferVersion,
          flow.reason.trim(), flow.preview.proof);
        setFlow(undefined);
        setNotice('待确认的 Owner 转让已取消，当前 Owner 保持不变。');
        await queryClient.invalidateQueries({ queryKey: ['console'] });
      }
    } catch (cause) {
      if (isConflict(cause)) await discardStalePreview(query, setFlow);
      else setFlow((current) => current === undefined ? current : { ...current, error: commandError(cause) });
    } finally {
      setBusy(false);
    }
  };

  return <section className="ownertransferpanel" aria-labelledby="ownertransferheading">
    <header className="ownertransferheader">
      <div><p>PLATFORM OWNERSHIP</p><h2 id="ownertransferheading">平台 Owner</h2>
        <span>平台始终保持唯一 Owner；最终交换在同一数据库事务内同步完成。</span></div>
      {canRead ? <Button onPress={() => { void query.refetch(); }} isDisabled={query.isFetching}>刷新状态</Button> : null}
    </header>
    {!canRead ? <Boundary title="Owner 状态保持关闭" message="当前会话缺少 access.ownership.read capability；重新授权并登录前不会猜测 Owner 状态。" />
      : query.isPending ? <p className="ownertransferloading" role="status">正在读取权威 Owner 状态…</p>
        : query.isError ? <Boundary title="无法读取权威状态" message={`${commandError(query.error)}。写操作保持关闭。`} danger />
          : ownership === undefined ? <Boundary title="响应不可用" message="未取得可校验的 Owner 状态，所有转让操作保持关闭。" danger />
            : <OwnerState ownership={ownership} context={context} isOwner={isOwner} isTarget={isTarget}
              notice={notice} onCreate={openCreate} onAccept={openAccept} onCancel={openCancel} />}
    {!canRead && enrollment !== undefined ? <OwnerTransferMobileEnrollment enrollment={enrollment} busy={busy}
      canManage={canManageMobile} onChange={setEnrollment} onVerifyPassword={() => { void verifyEnrollmentPassword(); }}
      onRequestCode={() => { void requestEnrollmentCode(); }} onBind={() => { void bindEnrollmentMobile(); }}
      onLogin={() => window.location.assign(loginUrl())} /> : null}
    <TransferDialog flow={flow} ownership={ownership} enrollment={enrollment} busy={busy} canManageMobile={canManageMobile}
      onClose={closeFlow} onChange={setFlow} onEnrollmentChange={setEnrollment}
      onVerifyPassword={() => { void verifyEnrollmentPassword(); }} onRequestMobileCode={() => { void requestEnrollmentCode(); }}
      onBindMobile={() => { void bindEnrollmentMobile(); }} onLogin={() => window.location.assign(loginUrl())}
      onBeginStepUp={() => { void beginStepUp(); }} onVerify={() => { void verifyAndPreview(); }} onExecute={() => { void execute(); }} />
    <AcceptedDialog open={accepted} />
  </section>;
}

function initialEnrollment(): MobileEnrollmentFlow {
  return { stage: 'password', password: '', mobile: '', code: '' };
}

function loginUrl(): string {
  return appConfig.identityEntryUrl;
}

async function createPreview(
  context: ConsoleContext,
  session: ConsoleSession,
  ownership: OwnershipState,
  flow: TransferFlow,
) {
  if (flow.action === 'create') return previewTransfer(context, session, configuration(flow), ownership.version);
  const pending = ownership.pending;
  if (pending === null) throw new Error('OWNER_TRANSFER_PENDING_MISSING');
  if (flow.action === 'accept') return previewAccept(context, session, pending.id, pending.version);
  return previewCancel(context, session, pending.id, pending.version, flow.reason.trim());
}

async function discardStalePreview(
  query: Readonly<{ refetch: () => Promise<unknown> }>,
  setFlow: (value: ((current: TransferFlow | undefined) => TransferFlow | undefined)) => void,
) {
  setFlow((current) => current === undefined ? current : { ...current, challenge: undefined, code: '', preview: undefined,
    elevatedSession: undefined, confirmed: false, error: '权威状态已变化，旧预览与 action proof 已丢弃。请核对新状态后重新验证。' });
  await query.refetch();
}

function isConflict(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.status === 409 || cause.status === 412);
}

function commandError(cause: unknown): string {
  if (cause instanceof ApiError) return `${cause.code} · 请求 ${cause.requestId}`;
  return cause instanceof Error ? cause.message : 'OWNER_TRANSFER_REQUEST_FAILED';
}
