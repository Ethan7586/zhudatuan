import { Button, Dialog } from '@shop/design';
import type { Dispatch, SetStateAction } from 'react';
import { appConfig } from '../../shared/config/AppConfig';
import {
  flowReadyForStepUp,
  formatDate,
  formerOwnerLabel,
  proofExpired,
  type MobileEnrollmentFlow,
  type TransferFlow,
} from './OwnerTransferModel';
import { OwnerTransferMobileEnrollment } from './OwnerTransferMobileEnrollment';
import type { OwnershipState } from './OwnerTransferSchema';
import { Boundary } from './OwnerTransferState';

export function TransferDialog({ flow, ownership, enrollment, busy, canManageMobile, onClose, onChange, onEnrollmentChange,
  onVerifyPassword, onRequestMobileCode, onBindMobile, onLogin, onBeginStepUp, onVerify, onExecute }: Readonly<{
  flow: TransferFlow | undefined;
  ownership: OwnershipState | undefined;
  enrollment: MobileEnrollmentFlow | undefined;
  busy: boolean;
  canManageMobile: boolean;
  onClose: () => void;
  onChange: Dispatch<SetStateAction<TransferFlow | undefined>>;
  onEnrollmentChange: Dispatch<SetStateAction<MobileEnrollmentFlow | undefined>>;
  onVerifyPassword: () => void;
  onRequestMobileCode: () => void;
  onBindMobile: () => void;
  onLogin: () => void;
  onBeginStepUp: () => void;
  onVerify: () => void;
  onExecute: () => void;
}>) {
  const title = flow?.action === 'accept' ? '确认接任 Owner' : flow?.action === 'cancel' ? '取消 Owner 转让' : '发起 Owner 转让';
  const target = ownership?.candidates.find(({ membership }) => membership === flow?.targetMembership);
  const pendingTarget = ownership?.pending?.targetDisplayName;
  return <Dialog open={flow !== undefined} title={title} eyebrow="STEP-UP → PREVIEW → ACTION PROOF → EXECUTE"
    onClose={onClose} dismissable={!busy}>
    {flow === undefined || ownership === undefined ? <p>未取得权威转让状态。</p> : <div className="ownertransferdialog">
      {flow.error === undefined ? null : <p className="ownertransfererror" role="alert">{flow.error}</p>}
      {enrollment !== undefined ? <OwnerTransferMobileEnrollment enrollment={enrollment} busy={busy} canManage={canManageMobile}
        onChange={onEnrollmentChange} onVerifyPassword={onVerifyPassword} onRequestCode={onRequestMobileCode}
        onBind={onBindMobile} onLogin={onLogin} />
        : flow.challenge === undefined ? <TransferConfiguration flow={flow} ownership={ownership} busy={busy}
        onChange={onChange} onContinue={onBeginStepUp} />
        : flow.preview === undefined ? <StepUpVerification flow={flow} busy={busy} onChange={onChange} onVerify={onVerify} />
          : <TransferReview flow={flow} targetName={target?.displayName ?? pendingTarget ?? flow.targetMembership}
            busy={busy} onChange={onChange} onExecute={onExecute} />}
    </div>}
  </Dialog>;
}

function TransferConfiguration({ flow, ownership, busy, onChange, onContinue }: Readonly<{
  flow: TransferFlow;
  ownership: OwnershipState;
  busy: boolean;
  onChange: Dispatch<SetStateAction<TransferFlow | undefined>>;
  onContinue: () => void;
}>) {
  const update = (change: Partial<TransferFlow>) => onChange((current) => current === undefined ? current : { ...current, ...change,
    preview: undefined, elevatedSession: undefined, confirmed: false, error: undefined });
  if (flow.action === 'accept') return <div className="ownertransfercommand"><Boundary title="接任后立即生效"
    message="最终确认会同步交换唯一 Owner 席位并撤销新旧 Owner 的现有会话；双方都必须重新登录。" danger />
    <p>你正在接受来自当前 Owner 的平台唯一 Owner 转让。</p><StepUpDestinationBoundary />
    <DialogFooter busy={busy} disabled={!ownership.mobileReady} label="发送本人短信验证码" onContinue={onContinue} /></div>;
  if (flow.action === 'cancel') return <div className="ownertransfercommand"><label>取消原因
    <textarea value={flow.reason} rows={3} maxLength={240} onChange={(event) => update({ reason: event.target.value })}
      placeholder="请说明取消原因（至少 8 个字）" /></label><Boundary title="取消也需要安全证明"
      message="系统会要求当前 Owner 本人的短信 Step-Up，并为本次取消签发独立 action proof。" /><StepUpDestinationBoundary />
    <DialogFooter busy={busy} disabled={flow.reason.trim().length < 8 || !ownership.mobileReady}
      label="发送本人短信验证码" onContinue={onContinue} /></div>;
  return <div className="ownertransfercommand"><label>接任管理员
    <select value={flow.targetMembership} onChange={(event) => update({ targetMembership: event.target.value })}>
      {ownership.candidates.map((candidate) => <option key={candidate.membership} value={candidate.membership}
        disabled={!candidate.mobileReady}>
        {candidate.displayName} · {candidate.roles.join('、') || '管理员'}{candidate.mobileReady ? '' : ' · 未绑定安全手机号'}
      </option>)}
    </select></label><fieldset><legend>原 Owner 转让后的后台身份</legend>
      <label><input type="radio" name="formerOwnerMode" checked={flow.formerOwnerMode === 'retain_admin'}
        disabled={ownership.formerOwnerRoles.length === 0}
        onChange={() => update({ formerOwnerMode: 'retain_admin', formerOwnerRole: ownership.formerOwnerRoles[0]?.id ?? '' })} />保留管理员身份</label>
      <label><input type="radio" name="formerOwnerMode" checked={flow.formerOwnerMode === 'remove_admin'}
        onChange={() => update({ formerOwnerMode: 'remove_admin', formerOwnerRole: '' })} />移除后台管理员身份</label>
    </fieldset>{flow.formerOwnerMode === 'retain_admin' ? <label>原 Owner 后续角色
      <select value={flow.formerOwnerRole} onChange={(event) => update({ formerOwnerRole: event.target.value })}>
        {ownership.formerOwnerRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select></label> : null}
    {ownership.formerOwnerRoles.length === 0 ? <Boundary title="没有可分配的原 Owner 管理员角色"
      message="仍可完成转让，但原 Owner 将卸下 Owner 并移除后台管理员身份；商城身份不会删除。" /> : null}
    <Boundary title="不会产生双 Owner 或零 Owner" message="发起阶段只建立待确认记录；接任人确认时才在单一数据库事务内交换席位。" />
    <StepUpDestinationBoundary />
    <DialogFooter busy={busy} disabled={!flowReadyForStepUp(flow, ownership)} label="发送本人短信验证码" onContinue={onContinue} />
  </div>;
}

function StepUpDestinationBoundary() {
  return <Boundary title="Step-Up 发送目标由 Canonical 决定"
    message="验证码只会发送到服务端保存的已验证手机号；本页不能向 Step-Up 传入或覆盖目标号码。" />;
}

function StepUpVerification({ flow, busy, onChange, onVerify }: Readonly<{
  flow: TransferFlow;
  busy: boolean;
  onChange: Dispatch<SetStateAction<TransferFlow | undefined>>;
  onVerify: () => void;
}>) {
  return <div className="ownertransfercommand"><p className="ownertransferchallenge" role="status">验证码已发送到当前登录账户绑定的手机号，
    有效期至 {formatDate(flow.challenge?.expiresAt ?? '')}。页面不会接收或覆盖发送目标。</p>
    <label htmlFor="ownerstepupcode">6 位短信验证码<input id="ownerstepupcode" value={flow.code} inputMode="numeric"
      autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" onChange={(event) => onChange((current) => current === undefined
        ? current : { ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6), error: undefined })} /></label>
    <DialogFooter busy={busy} disabled={!/^\d{6}$/.test(flow.code)} label="验证并生成权威预览" onContinue={onVerify} />
  </div>;
}

function TransferReview({ flow, targetName, busy, onChange, onExecute }: Readonly<{
  flow: TransferFlow;
  targetName: string;
  busy: boolean;
  onChange: Dispatch<SetStateAction<TransferFlow | undefined>>;
  onExecute: () => void;
}>) {
  const preview = flow.preview;
  if (preview === undefined) return null;
  const expired = proofExpired(preview.proofExpiresAt);
  const label = flow.action === 'accept' ? '同步接受 Owner 转让' : flow.action === 'cancel' ? '确认取消转让' : '发起待确认转让';
  return <div className="ownertransfercommand"><section className="ownertransferpreview" aria-labelledby="ownerpreviewheading">
    <h3 id="ownerpreviewheading">服务端权威预览</h3><dl><div><dt>目标</dt><dd>{targetName}</dd></div>
      <div><dt>Ownership Version</dt><dd>{preview.ownershipVersion}</dd></div>
      {'transferVersion' in preview ? <div><dt>Transfer Version</dt><dd>{preview.transferVersion}</dd></div> : null}
      <div><dt>目标 Access Version</dt><dd>{preview.targetAccessVersion}</dd></div>
      <div><dt>原 Owner 后续身份</dt><dd>{formerOwnerLabel(preview.formerOwnerMode)}</dd></div>
      <div><dt>原 Owner 后续角色</dt><dd>{preview.formerOwnerMode === 'retain_admin'
        ? `${preview.formerOwnerRole ?? '角色缺失'} / v${preview.formerOwnerRoleVersion ?? '版本缺失'}` : '无'}</dd></div>
      <div><dt>Proof 有效期</dt><dd>{formatDate(preview.proofExpiresAt)}</dd></div></dl>
    <p>Action proof 仅保存在本页内存中，不展示、不写入 URL 或浏览器存储。</p></section>
    {expired ? <Boundary title="预览已过期" message="Action proof 已失效，请关闭后重新完成短信 Step-Up 与预览。" danger /> : null}
    {flow.elevatedSession?.csrf === undefined ? <Boundary title="CSRF 回执缺失" message="Step-Up 后重读的会话没有返回 CSRF token，危险提交保持关闭。" danger /> : null}
    <label className="ownertransferconfirm"><input type="checkbox" checked={flow.confirmed}
      onChange={(event) => onChange((current) => current === undefined ? current : { ...current, confirmed: event.target.checked })} />
      我已核对目标、版本与身份变化，并确认执行</label>
    <DialogFooter busy={busy} disabled={expired || !flow.confirmed || flow.elevatedSession?.csrf === undefined}
      label={label} onContinue={onExecute} danger={flow.action !== 'accept'} />
  </div>;
}

function DialogFooter({ busy, disabled, label, onContinue, danger = false }: Readonly<{
  busy: boolean;
  disabled: boolean;
  label: string;
  onContinue: () => void;
  danger?: boolean;
}>) {
  return <footer><Button tone={danger ? 'danger' : 'primary'} isDisabled={busy || disabled} onPress={onContinue}>
    {busy ? '正在校验…' : label}</Button></footer>;
}

export function AcceptedDialog({ open }: Readonly<{ open: boolean }>) {
  const login = appConfig.identityEntryUrl;
  return <Dialog open={open} title="Owner 已同步交换" eyebrow="ATOMIC COMMIT COMPLETE" onClose={() => window.location.assign(login)} dismissable={false}>
    <div className="ownertransferreceipt" role="status"><strong>唯一 Owner 席位已完成交换</strong>
      <p>服务端已在同一事务内完成角色交换、Access Version 更新与双方会话撤销。请重新登录取得新权限。</p>
      <Button tone="primary" onPress={() => window.location.assign(login)}>重新登录 Console</Button></div>
  </Dialog>;
}
