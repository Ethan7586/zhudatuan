import { Dialog } from '@shop/design';
import { permissionText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { TargetSummary } from './TargetSummary';

export function RoleDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'role') return null;
  return (
    <Dialog open title="编辑自定义角色" eyebrow="角色权限 · 默认拒绝 · 双人复核" onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <TargetSummary membership={editor.membership} />
        <label>
          角色名称
          <input value={editor.name} maxLength={120} onChange={(event) => model.actions.name(event.target.value)} required />
        </label>
        <fieldset className="accessmatrix">
          <legend>角色权限</legend>
          <p>为每项业务权限选择“允许”“拒绝”或“沿用上级”；拒绝规则始终优先。</p>
          {model.permissions.map((permission) => {
            const rule = editor.denies.includes(permission) ? 'deny' : editor.allows.includes(permission) ? 'allow' : 'inherit';
            return (
              <div className="accessmatrixrow" key={permission}>
                <span>
                  <strong>{permissionText(permission)}</strong>
                  <small>{permission}</small>
                </span>
                <select aria-label={`${permissionText(permission)}的授权规则`} value={rule} onChange={(event) => model.actions.permissionRule(permission, event.target.value as typeof rule)}>
                  <option value="inherit">沿用上级</option>
                  <option value="allow">允许</option>
                  <option value="deny">拒绝</option>
                </select>
              </div>
            );
          })}
        </fieldset>
        <ApprovalPanel model={model} />
      </form>
    </Dialog>
  );
}
