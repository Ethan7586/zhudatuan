import { Dialog } from '@shop/design';
import type { OwnershipImpact } from '../model/Access';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';

export function OwnerTransferDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'owner') return null;
  const labels = actionLabels(editor.action);
  return (
    <Dialog open title={labels.title} eyebrow={labels.eyebrow} onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <section className="accesstarget" aria-label="当前所有者">
          <strong>当前所有者</strong>
          <span>{editor.ownership.owner.displayName}</span>
          <small>所有权版本：第 {editor.ownership.version} 版</small>
        </section>
        {editor.action === 'create' ? <CreateFields model={model} /> : <PendingSummary model={model} />}
        {editor.preview ? <ImpactPreview impact={editor.preview.impact} expiresAt={editor.preview.action === 'create' ? editor.preview.expiresAt : editor.preview.transfer.expiresAt} /> : null}
        <ApprovalPanel model={model} destructive />
      </form>
    </Dialog>
  );
}

function CreateFields({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'owner' || editor.action !== 'create') return null;
  return (
    <>
      <section className="accessdanger">
        <strong>先发起申请，再由新所有者接受</strong>
        <p>发起申请不会立即切换权限。申请在 24 小时内有效；只有目标账号完成独立验证并接受后，所有权和双方权限版本才会原子更新。</p>
      </section>
      <label>
        新所有者
        <select value={editor.targetId} onChange={(event) => model.actions.target(event.target.value)} required>
          <option value="" disabled>
            请选择活跃的控制台账号
          </option>
          {model.ownerTargets.map((target) => (
            <option key={target.membership} value={target.membership} disabled={!target.mobileReady}>
              {target.displayName} · 权限第 {target.accessVersion} 版{target.mobileReady ? '' : ' · 未绑定手机'}
            </option>
          ))}
        </select>
      </label>
      {model.ownerTargets.length === 0 ? (
        <p className="accesserror" role="alert">
          当前范围没有可接收所有权的活跃控制台账号。
        </p>
      ) : null}
      <fieldset className="accesschoice">
        <legend>转移后如何处理原所有者</legend>
        <label>
          <input type="radio" name="former-owner-mode" checked={editor.formerOwnerMode === 'retain_admin'} onChange={() => model.actions.formerOwnerMode('retain_admin')} />
          保留为普通管理员
        </label>
        <label>
          <input type="radio" name="former-owner-mode" checked={editor.formerOwnerMode === 'remove_admin'} onChange={() => model.actions.formerOwnerMode('remove_admin')} />
          移除后台管理员身份
        </label>
      </fieldset>
      {editor.formerOwnerMode === 'retain_admin' ? (
        <label>
          原所有者保留角色
          <select value={editor.formerOwnerRole} onChange={(event) => model.actions.formerOwnerRole(event.target.value)} required>
            <option value="" disabled>
              请选择普通管理员角色
            </option>
            {editor.ownership.formerOwnerRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} · 第 {role.version} 版
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        转移原因
        <textarea value={editor.reason} minLength={4} maxLength={500} onChange={(event) => model.actions.reason(event.target.value)} placeholder="例如：负责人岗位调整（4 至 500 字）" required />
      </label>
    </>
  );
}

function PendingSummary({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'owner' || editor.action === 'create' || editor.transfer === null) return null;
  return (
    <>
      <section className={editor.action === 'accept' ? 'accessdanger' : 'accesshint'}>
        <strong>{editor.action === 'accept' ? '接受后立即成为新所有者' : '取消后申请立即失效'}</strong>
        <span>目标账号：{editor.transfer.targetDisplayName}</span>
        <span>有效期至：{new Date(editor.transfer.expiresAt).toLocaleString('zh-CN')}</span>
        <span>申请版本：第 {editor.transfer.version} 版</span>
      </section>
      {editor.action === 'cancel' ? (
        <label>
          取消原因
          <textarea value={editor.reason} minLength={4} maxLength={500} onChange={(event) => model.actions.reason(event.target.value)} placeholder="说明取消原因（4 至 500 字）" required />
        </label>
      ) : null}
    </>
  );
}

function ImpactPreview({ impact, expiresAt }: Readonly<{ impact: OwnershipImpact; expiresAt: string }>) {
  return (
    <section className="accessimpact" aria-label="变更影响预演">
      <strong>服务端预演已通过</strong>
      <div>
        <span>影响账号</span>
        <b>{impact.affectedPeople} 个</b>
        <span>影响范围</span>
        <b>{impact.affectedScopes} 个</b>
      </div>
      <ul>
        {impact.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      <small>发起后有 24 小时冷静期，申请 7 天后到期（{new Date(expiresAt).toLocaleString('zh-CN')}）；提交时将再次校验所有版本。</small>
    </section>
  );
}

function actionLabels(action: 'create' | 'accept' | 'cancel') {
  if (action === 'accept') return Object.freeze({ title: '接受所有权', eyebrow: '关键权限 · 目标方确认 · 原子切换' });
  if (action === 'cancel') return Object.freeze({ title: '取消转移申请', eyebrow: '关键权限 · 原所有者操作 · 留痕' });
  return Object.freeze({ title: '发起所有权转移', eyebrow: '关键权限 · 双方证明 · 24 小时有效' });
}
