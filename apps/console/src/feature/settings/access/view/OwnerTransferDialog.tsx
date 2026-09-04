import { Dialog } from '@shop/design';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { accountLabel, TargetSummary } from './TargetSummary';

export function OwnerTransferDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'owner') return null;
  return (
    <Dialog open title="转移所有权" eyebrow="关键权限 · 立即生效 · 双人复核" onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <TargetSummary membership={editor.membership} />
        <section className="accessdanger">
          <strong>此操作会改变当前所有者</strong>
          <p>执行后，当前账号失去所有者角色，新账号立即获得所有者角色；双方权限版本同时递增，当前会话将重新校验。</p>
        </section>
        <label>
          新所有者
          <select value={editor.targetId} onChange={(event) => model.actions.target(event.target.value)} required>
            <option value="" disabled>
              请选择活跃的控制台账号
            </option>
            {model.ownerTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.displayName} · {accountLabel(target)} · 第 {target.accessVersion} 版
              </option>
            ))}
          </select>
        </label>
        {model.ownerTargets.length === 0 ? (
          <p className="accesserror" role="alert">
            当前页没有可接收所有权的活跃控制台账号。
          </p>
        ) : null}
        <label>
          转移原因
          <textarea value={editor.reason} minLength={4} maxLength={500} onChange={(event) => model.actions.reason(event.target.value)} required />
        </label>
        <ApprovalPanel model={model} destructive />
      </form>
    </Dialog>
  );
}
