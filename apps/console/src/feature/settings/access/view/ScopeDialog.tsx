import { Dialog } from '@shop/design';
import type { AccessScopeKind } from '../model/Access';
import { scopeText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { EffectFields } from './OverrideDialog';
import { TargetSummary } from './TargetSummary';

const kinds: readonly AccessScopeKind[] = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand'];

export function ScopeDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'scope') return null;
  return (
    <Dialog open title="配置项目范围" eyebrow="数据范围 · 显式效果 · 双人复核" onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <TargetSummary membership={editor.membership} />
        <label>
          授权范围
          <select value={editor.scopeKind} onChange={(event) => model.actions.scopeKind(event.target.value as AccessScopeKind)}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {scopeText(kind)}
              </option>
            ))}
          </select>
        </label>
        <label>
          项目或资源标识
          <input value={editor.resource} onChange={(event) => model.actions.resource(event.target.value)} required />
        </label>
        <EffectFields effect={editor.effect} expiresAt={editor.expiresAt} model={model} />
        <ApprovalPanel model={model} />
      </form>
    </Dialog>
  );
}
