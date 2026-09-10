import { Dialog } from '@shop/design';
import { roleName } from '../AccessText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { TechnicalDetails } from './TechnicalDetails';

export function RoleActionDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'role' || editor.action === 'save') return null;
  const destructive = editor.action === 'delete' || editor.action === 'revoke' || (editor.action === 'status' && editor.status === 'disabled');
  const title = editor.action === 'assign' ? '授予成员角色' : editor.action === 'revoke' ? '撤销成员角色' : editor.action === 'delete' ? '删除未使用角色' : editor.action === 'status' && editor.status === 'active' ? '启用角色' : '停用角色';
  return (
    <Dialog open title={title} eyebrow="岗位变更 · 影响复核 · 双人复核" onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <section className="accesstarget">
          <span>目标岗位</span>
          <strong>{roleName(editor.role)}</strong>
          <small>{editor.role.description}</small>
        </section>
        {'membership' in editor ? (
          <section className="accesstarget">
            <span>目标成员</span>
            <strong>{editor.membership.displayName}</strong>
            <small>保存时系统会自动核对最新授权状态。</small>
          </section>
        ) : null}
        <TechnicalDetails
          facts={[
            { label: '岗位标识', value: <code>{editor.role.id}</code> },
            { label: '岗位版本', value: `第 ${editor.role.version} 版` },
            ...('membership' in editor
              ? [
                  { label: '成员标识', value: <code>{editor.membership.id}</code> },
                  { label: '授权版本', value: `第 ${editor.membership.accessVersion} 版` },
                ]
              : []),
          ]}
        />
        {editor.action === 'status' ? (
          <p className="accesshint">{editor.status === 'disabled' ? `停用后 ${editor.role.affectedPeople} 位成员将立即失去该角色的权限，旧会话随权限版本失效。` : '启用角色不会自动授予成员；需要另行选择成员。'}</p>
        ) : null}
        {editor.action === 'delete' ? <p className="accessdanger">只有从未授予任何成员的自定义角色可以删除；有历史或当前分配时服务端会拒绝。</p> : null}
        <ApprovalPanel model={model} destructive={destructive} />
      </form>
    </Dialog>
  );
}
