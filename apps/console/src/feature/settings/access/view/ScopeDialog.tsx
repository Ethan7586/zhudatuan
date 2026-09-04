import { Dialog } from '@shop/design';
import type { AccessScopeKind } from '../model/Access';
import { scopeText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { EffectFields } from './OverrideDialog';
import { TargetSummary } from './TargetSummary';

const manageableKinds: readonly AccessScopeKind[] = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand'];

export function ScopeDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'scope') return null;
  const available = model.scopes.filter((scope) => manageableKinds.includes(scope.kind));
  const kinds = [...new Set(available.map((scope) => scope.kind))];
  const scopes = available.filter((scope) => scope.kind === editor.scopeKind);
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
          项目类型
          <select value={editor.scopeKind} onChange={(event) => model.actions.scopeKind(event.target.value as typeof editor.scopeKind)}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {scopeText(kind)}
              </option>
            ))}
          </select>
        </label>
        <label>
          授权项目
          <select value={editor.resource} onChange={(event) => model.actions.resource(event.target.value)} required>
            {scopes.map((scope) => <option key={`${scope.kind}:${scope.id}`} value={scope.id}>{scope.name ?? `${scopeText(scope.kind)}（名称未设置）`}</option>)}
          </select>
        </label>
        {model.scopesPending ? <p className="accesshint" role="status">正在读取可委派项目…</p> : null}
        {model.scopeError ? <p className="accesserror" role="alert">可委派项目暂时无法加载：{model.scopeError} <button type="button" onClick={model.actions.refreshScopes}>重试</button></p> : null}
        {!model.scopesPending && !model.scopeError && scopes.length === 0 ? <p className="accesserror" role="alert">当前账号没有可委派的{scopeText(editor.scopeKind)}项目，请先在组织中心完成项目授权。</p> : null}
        {scopes.length > 0 ? <p className="accesshint">只显示组织目录中的活跃项目，不需要填写内部编号。</p> : null}
        <EffectFields effect={editor.effect} expiresAt={editor.expiresAt} model={model} />
        <ApprovalPanel model={model} />
      </form>
    </Dialog>
  );
}
