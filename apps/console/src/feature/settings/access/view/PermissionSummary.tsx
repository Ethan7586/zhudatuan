import { permissionText } from '../PermissionText';

export function PermissionSummary({ allows, denies, owner = false }: Readonly<{ allows: readonly string[]; denies: readonly string[]; owner?: boolean }>) {
  if (owner) {
    return (
      <div className="permissionsummary permissionsummaryowner">
        <strong>最高管理权限</strong>
        <p>此成员负责当前管理范围的全部治理工作。为保障安全，所有权只能通过专门的双向交接流程变更。</p>
      </div>
    );
  }
  return (
    <div className="permissionsummary">
      <PermissionGroup title="可以执行" values={allows} empty="当前岗位没有授予额外业务操作" />
      <PermissionGroup title="明确不可执行" values={denies} empty="没有额外限制" denied />
    </div>
  );
}

function PermissionGroup({ title, values, empty, denied = false }: Readonly<{ title: string; values: readonly string[]; empty: string; denied?: boolean }>) {
  const visible = values.slice(0, 4);
  const remaining = values.slice(4);
  return (
    <section className={denied ? 'permissiongroup denied' : 'permissiongroup'}>
      <header>
        <strong>{title}</strong>
        <span>{values.length} 项</span>
      </header>
      {values.length === 0 ? <p>{empty}</p> : <ul>{visible.map((permission) => <li key={permission}>{permissionText(permission)}</li>)}</ul>}
      {remaining.length ? (
        <details>
          <summary>查看其余 {remaining.length} 项</summary>
          <ul>{remaining.map((permission) => <li key={permission}>{permissionText(permission)}</li>)}</ul>
        </details>
      ) : null}
    </section>
  );
}
