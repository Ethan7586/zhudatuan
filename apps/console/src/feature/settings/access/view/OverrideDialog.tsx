import { Dialog } from '@shop/design';
import { useMemo, useState } from 'react';
import { permissionGroups } from '../PermissionCatalog';
import { permissionText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { TargetSummary } from './TargetSummary';
import { TechnicalDetails } from './TechnicalDetails';
import type { AccessEffect, AccessOverrideAction } from '../model/Access';

export function OverrideDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'override') return null;
  return <OverrideForm model={model} />;
}

function OverrideForm({ model }: Readonly<{ model: AccessViewModel }>) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => permissionGroups(model.permissions, query), [model.permissions, query]);
  const editor = model.editor;
  if (editor?.kind !== 'override') return null;
  return (
    <Dialog open title="设置个人权限例外" eyebrow="仅用于少数特殊情况" onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <TargetSummary membership={editor.membership} />
        <label>
          要做什么
          <select value={editor.action} onChange={(event) => model.actions.overrideAction(event.target.value as AccessOverrideAction)}>
            <option value="set">新增或更新个人例外</option>
            <option value="revoke">撤销已有个人例外</option>
          </select>
        </label>
        <label>
          搜索业务权限
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              model.actions.permission('');
            }}
            placeholder="例如：退款、库存、审批"
          />
        </label>
        <label>
          选择业务权限
          <select value={editor.permission} onChange={(event) => model.actions.permission(event.target.value)} required>
            <option value="" disabled>
              请选择要调整的权限
            </option>
            {groups.map((group) => (
              <optgroup key={group.category} label={group.name}>
                {group.permissions.map((permission) => (
                  <option key={permission.code} value={permission.code}>
                    {permissionText(permission.code)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {groups.length === 0 ? (
          <p className="accesserror" role="status">
            没有匹配权限。可尝试“售后”“返款”等同义词。
          </p>
        ) : null}
        {editor.permission ? (
          <section className="accesshint">
            所选权限：{permissionText(editor.permission)}
            <TechnicalDetails facts={[{ label: '权限标识', value: <code>{editor.permission}</code> }]} />
          </section>
        ) : null}
        {editor.action === 'set' ? <EffectFields effect={editor.effect} expiresAt={editor.expiresAt} model={model} /> : null}
        <label>
          审计原因
          <textarea value={editor.reason} minLength={4} maxLength={500} onChange={(event) => model.actions.reason(event.target.value)} required />
        </label>
        <ApprovalPanel model={model} />
      </form>
    </Dialog>
  );
}

export function EffectFields({ effect, expiresAt, model }: Readonly<{ effect: AccessEffect; expiresAt: string; model: AccessViewModel }>) {
  return (
    <div className="accessfieldgrid">
      <label>
        效果
        <select value={effect} onChange={(event) => model.actions.effect(event.target.value as AccessEffect)}>
          <option value="allow">允许</option>
          <option value="deny">拒绝</option>
        </select>
      </label>
      <label>
        失效时间（可选）
        <input type="datetime-local" value={expiresAt} onChange={(event) => model.actions.expiresAt(event.target.value)} />
      </label>
    </div>
  );
}
