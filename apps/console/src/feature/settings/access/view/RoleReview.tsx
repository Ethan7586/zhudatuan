import { permissionDefinition } from '../PermissionCatalog';
import { permissionText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';

export function RoleReview({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'role' || editor.action !== 'save') return null;
  const currentAllows = new Set(editor.role.allows);
  const currentDenies = new Set(editor.role.denies);
  const addedAllows = editor.allows.filter((code) => !currentAllows.has(code));
  const removedAllows = editor.role.allows.filter((code) => !editor.allows.includes(code));
  const addedDenies = editor.denies.filter((code) => !currentDenies.has(code));
  const removedDenies = editor.role.denies.filter((code) => !editor.denies.includes(code));
  const critical = [...new Set([...addedAllows, ...addedDenies])].filter((code) => {
    const definition = permissionDefinition(code);
    return definition?.risk === 'critical' || definition?.makerChecker;
  });
  const allowed = new Set(editor.allows);
  const conflicts = model.page?.separationRules.filter((rule) => allowed.has(rule.left) && allowed.has(rule.right)) ?? [];
  return (
    <section className="rolereview" aria-labelledby="rolereviewtitle">
      <header>
        <h2 id="rolereviewtitle">保存前复核</h2>
        <p>请确认变化、受影响对象和关键权限，再生成双人复核请求。</p>
      </header>
      <div className="roleimpactgrid">
        <span>
          <strong>{editor.role.affectedPeople}</strong> 位受影响成员
        </span>
        <span>
          <strong>{editor.role.affectedScopes}</strong> 个生效范围
        </span>
        <span>
          <strong>
            +{addedAllows.length} / -{removedAllows.length}
          </strong>{' '}
          允许权限
        </span>
        <span>
          <strong>
            +{addedDenies.length} / -{removedDenies.length}
          </strong>{' '}
          明确拒绝
        </span>
      </div>
      <Diff title="新增允许" values={addedAllows} />
      <Diff title="移除允许" values={removedAllows} />
      <Diff title="新增明确拒绝" values={addedDenies} />
      <Diff title="移除明确拒绝" values={removedDenies} />
      {critical.length ? (
        <div className="rolewarning">
          <strong>关键权限</strong>
          <p>{critical.map(permissionText).join('、')}；这些动作执行时还会再次要求二次验证或双人复核。</p>
        </div>
      ) : null}
      {conflicts.length ? (
        <div className="accessconflict" role="alert">
          <strong>职责分离冲突，当前方案不能保存</strong>
          {conflicts.map((rule) => (
            <p key={`${rule.left}:${rule.right}`}>{rule.reason}</p>
          ))}
        </div>
      ) : (
        <p className="rolesafe">未发现职责分离冲突；服务端仍会按最新规则再次校验。</p>
      )}
      <ApprovalPanel model={model} />
    </section>
  );
}

function Diff({ title, values }: Readonly<{ title: string; values: readonly string[] }>) {
  return (
    <div className="rolediff">
      <strong>{title}</strong>
      <span>{values.length ? values.map(permissionText).join('、') : '无'}</span>
    </div>
  );
}
