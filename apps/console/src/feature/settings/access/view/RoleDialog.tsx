import { Button, Dialog } from '@shop/design';
import { useEffect, useMemo, useState } from 'react';
import { permissionDefinition, permissionGroups, permissionRisk } from '../PermissionCatalog';
import { permissionText, scopeText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { ApprovalPanel } from './ApprovalPanel';

export function RoleDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'role') return null;
  if (editor.action !== 'save') return <RoleActionDialog model={model} />;
  return <RoleSaveDialog model={model} />;
}

function RoleSaveDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  const template = editor?.kind === 'role' && editor.action === 'save' ? editor.template : undefined;
  const [advanced, setAdvanced] = useState(template === 'custom');
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (template === 'custom') setAdvanced(true);
  }, [template]);
  const groups = useMemo(() => permissionGroups(model.permissions, query), [model.permissions, query]);
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
  const isNew = editor.role.version === 0;
  return (
    <Dialog open title={isNew ? '新建岗位角色' : '编辑岗位角色'} eyebrow={`第 ${editor.step} 步，共 3 步`} onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form
        className="accessform rolejourney"
        onSubmit={(event) => {
          event.preventDefault();
          if (editor.step < 3) model.actions.roleStep((editor.step + 1) as 2 | 3);
          else model.actions.submit();
        }}
      >
        <nav className="rolesteps" aria-label="新建角色步骤">
          {(['选择岗位模板', '选择范围与权限', '复核并保存'] as const).map((label, index) => (
            <button key={label} type="button" aria-current={editor.step === index + 1 ? 'step' : undefined} onClick={() => model.actions.roleStep((index + 1) as 1 | 2 | 3)}>
              <span>{index + 1}</span>{label}
            </button>
          ))}
        </nav>

        {editor.step === 1 ? (
          <section className="roletemplates" aria-labelledby="roletemplatetitle">
            <header><h2 id="roletemplatetitle">先选择最接近的岗位</h2><p>模板只提供安全起点，下一步仍可按业务需要调整。</p></header>
            <div>
              {model.page?.templates.map((template) => (
                <button key={template.code} type="button" className={editor.template === template.code ? 'selected' : ''} aria-pressed={editor.template === template.code} onClick={() => model.actions.roleTemplate(template.code)}>
                  <strong>{template.name}</strong><span>{template.description}</span><small>{template.allows.length} 项允许 · {template.denies.length} 项明确拒绝</small>
                </button>
              ))}
            </div>
            <label>角色名称<input value={editor.name} maxLength={120} onChange={(event) => model.actions.name(event.target.value)} placeholder="例如：华东区商品运营" required /></label>
            <label>角色说明<textarea value={editor.description} maxLength={300} onChange={(event) => model.actions.description(event.target.value)} placeholder="说明这个岗位负责什么、适合授予谁（至少 4 个字）" required /></label>
          </section>
        ) : null}

        {editor.step === 2 ? (
          <section className="rolepermissions" aria-labelledby="rolepermissiontitle">
            <header><div><h2 id="rolepermissiontitle">管理范围与功能权限</h2><p>角色只在当前业务范围内生效，成员的更细范围在“项目范围”任务中维护。</p></div></header>
            <div className="rolescope"><span>当前管理范围</span><strong>{scopeText(model.scope.kind)} · {model.scope.name ?? '当前工作区'}</strong><small>不会要求填写内部范围编号，也不会越过当前工作区。</small></div>
            <div className="rolepermissionsummary">
              <span><strong>{editor.allows.length}</strong> 项允许</span><span><strong>{editor.denies.length}</strong> 项明确拒绝</span>
              <Button onPress={() => setAdvanced((value) => !value)}>{advanced ? '收起高级权限' : '调整高级权限'}</Button>
            </div>
            {advanced ? (
              <div className="roleadvanced">
                <label>搜索业务权限<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：退款、库存、审批；也可输入权限代码" /></label>
                <p>拒绝始终优先于允许。分类默认折叠；搜索时自动展开匹配结果。</p>
                {groups.length === 0 ? <div className="roleempty" role="status"><strong>没有匹配结果</strong><span>可尝试“售后”“返款”等同义词，或输入高级权限代码。</span></div> : groups.map((group) => (
                  <details key={group.category} open={query.trim().length > 0}>
                    <summary><span>{group.name}</span><small>{group.permissions.length} 项</small></summary>
                    <div className="accessmatrix">
                      {group.permissions.map((permission) => {
                        const rule = editor.denies.includes(permission.code) ? 'deny' : editor.allows.includes(permission.code) ? 'allow' : 'inherit';
                        return (
                          <div className="accessmatrixrow" key={permission.code}>
                            <span><strong>{permissionText(permission.code)}</strong><small>{permissionRisk(permission)}{permission.makerChecker ? ' · 需要双人复核' : ''}</small><code>{permission.code}</code></span>
                            <select aria-label={`${permissionText(permission.code)}的授权规则`} value={rule} onChange={(event) => model.actions.permissionRule(permission.code, event.target.value as typeof rule)}>
                              <option value="inherit">不授予</option><option value="allow">允许</option><option value="deny">明确拒绝</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            ) : <p className="roletemplatehint">当前使用“{model.page?.templates.find((template) => template.code === editor.template)?.name ?? '自定义'}”模板。高级权限保持收起，减少一次面对全部权限的认知负担。</p>}
          </section>
        ) : null}

        {editor.step === 3 ? (
          <section className="rolereview" aria-labelledby="rolereviewtitle">
            <header><h2 id="rolereviewtitle">保存前复核</h2><p>请确认变化、受影响对象和关键权限，再生成双人复核请求。</p></header>
            <div className="roleimpactgrid">
              <span><strong>{editor.role.affectedPeople}</strong> 位受影响成员</span><span><strong>{editor.role.affectedScopes}</strong> 个生效范围</span>
              <span><strong>+{addedAllows.length} / -{removedAllows.length}</strong> 允许权限</span><span><strong>+{addedDenies.length} / -{removedDenies.length}</strong> 明确拒绝</span>
            </div>
            <Diff title="新增允许" values={addedAllows} /><Diff title="移除允许" values={removedAllows} /><Diff title="新增明确拒绝" values={addedDenies} /><Diff title="移除明确拒绝" values={removedDenies} />
            {critical.length ? <div className="rolewarning"><strong>关键权限</strong><p>{critical.map(permissionText).join('、')}；这些动作执行时还会再次要求二次验证或双人复核。</p></div> : null}
            {conflicts.length ? <div className="accessconflict" role="alert"><strong>职责分离冲突，当前方案不能保存</strong>{conflicts.map((rule) => <p key={`${rule.left}:${rule.right}`}>{rule.reason}</p>)}</div> : <p className="rolesafe">未发现职责分离冲突；服务端仍会按最新规则再次校验。</p>}
            <ApprovalPanel model={model} />
          </section>
        ) : null}

        {editor.step < 3 ? <footer><Button onPress={model.actions.close}>稍后继续</Button>{editor.step > 1 ? <Button onPress={() => model.actions.roleStep((editor.step - 1) as 1 | 2)}>上一步</Button> : null}<Button type="submit" tone="primary">下一步</Button></footer> : null}
      </form>
    </Dialog>
  );
}

function RoleActionDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'role' || editor.action === 'save') return null;
  const destructive = editor.action === 'delete' || editor.action === 'revoke' || (editor.action === 'status' && editor.status === 'disabled');
  const title = editor.action === 'assign' ? '授予成员角色' : editor.action === 'revoke' ? '撤销成员角色' : editor.action === 'delete' ? '删除未使用角色' : editor.action === 'status' && editor.status === 'active' ? '启用角色' : '停用角色';
  return (
    <Dialog open title={title} eyebrow="角色治理 · 权威版本 · 双人复核" onClose={model.actions.close} dismissable={!model.mutation.busy}>
      <form className="accessform" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
        <section className="accesstarget"><span>目标角色</span><strong>{editor.role.name}</strong><small>{editor.role.description}</small></section>
        {'membership' in editor ? <section className="accesstarget"><span>目标成员</span><strong>{editor.membership.displayName}</strong><small>当前权限第 {editor.membership.accessVersion} 版</small></section> : null}
        {editor.action === 'status' ? <p className="accesshint">{editor.status === 'disabled' ? `停用后 ${editor.role.affectedPeople} 位成员将立即失去该角色的权限，旧会话随权限版本失效。` : '启用角色不会自动授予成员；需要另行选择成员。'}</p> : null}
        {editor.action === 'delete' ? <p className="accessdanger">只有从未授予任何成员的自定义角色可以删除；有历史或当前分配时服务端会拒绝。</p> : null}
        <ApprovalPanel model={model} destructive={destructive} />
      </form>
    </Dialog>
  );
}

function Diff({ title, values }: Readonly<{ title: string; values: readonly string[] }>) {
  return <div className="rolediff"><strong>{title}</strong><span>{values.length ? values.map(permissionText).join('、') : '无'}</span></div>;
}
