import { Button, Dialog } from '@shop/design';
import { useEffect, useMemo, useState } from 'react';
import { permissionGroups, permissionRisk } from '../PermissionCatalog';
import { permissionText, scopeText } from '../PermissionText';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { RoleActionDialog } from './RoleActionDialog';
import { RoleReview } from './RoleReview';
import { TechnicalDetails } from './TechnicalDetails';

export function RoleDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'role') return null;
  if (editor.action !== 'save') return <RoleActionDialog model={model} />;
  return <RoleSaveDialog model={model} />;
}

function RoleSaveDialog({ model }: Readonly<{ model: AccessViewModel }>) {
  const editor = model.editor;
  const template = editor?.kind === 'role' && editor.action === 'save' ? editor.template : undefined;
  const [advanced, setAdvanced] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    setAdvanced(false);
    setQuery('');
  }, [template]);
  const groups = useMemo(() => permissionGroups(model.permissions, query), [model.permissions, query]);
  if (editor?.kind !== 'role' || editor.action !== 'save') return null;
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
          {(['选择岗位模板', '选择管理范围', '复核并保存'] as const).map((label, index) => (
            <button key={label} type="button" aria-current={editor.step === index + 1 ? 'step' : undefined} onClick={() => model.actions.roleStep((index + 1) as 1 | 2 | 3)}>
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>

        {editor.step === 1 ? (
          <section className="roletemplates" aria-labelledby="roletemplatetitle">
            <header>
              <h2 id="roletemplatetitle">先选择最接近的岗位</h2>
              <p>模板只提供安全起点，下一步仍可按业务需要调整。</p>
            </header>
            <div>
              {model.page?.templates.map((template) => (
                <button key={template.code} type="button" className={editor.template === template.code ? 'selected' : ''} aria-pressed={editor.template === template.code} onClick={() => model.actions.roleTemplate(template.code)}>
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                  <small>
                    {template.allows.length} 项允许 · {template.denies.length} 项明确拒绝
                  </small>
                </button>
              ))}
            </div>
            <label>
              角色名称
              <input value={editor.name} maxLength={120} onChange={(event) => model.actions.name(event.target.value)} placeholder="例如：华东区商品运营" required />
            </label>
            <label>
              角色说明
              <textarea value={editor.description} maxLength={300} onChange={(event) => model.actions.description(event.target.value)} placeholder="说明这个岗位负责什么、适合授予谁（至少 4 个字）" required />
            </label>
          </section>
        ) : null}

        {editor.step === 2 ? (
          <section className="rolepermissions" aria-labelledby="rolepermissiontitle">
            <header>
              <div>
                <h2 id="rolepermissiontitle">确认管理范围</h2>
                <p>岗位在当前业务范围内生效；成员能看到哪些商城或门店，继续由“项目范围”限定。</p>
              </div>
            </header>
            <div className="rolescope">
              <span>当前管理范围</span>
              <strong>
                {scopeText(model.scope.kind)} · {model.scope.name ?? '当前工作区'}
              </strong>
              <small>不会要求填写内部范围编号，也不会越过当前工作区。</small>
            </div>
            <div className="rolepermissionsummary">
              <span>
                <strong>{editor.allows.length}</strong> 项允许
              </span>
              <span>
                <strong>{editor.denies.length}</strong> 项明确拒绝
              </span>
              {editor.template === 'custom' ? <Button onPress={() => setAdvanced((value) => !value)}>{advanced ? '收起高级权限' : '打开高级权限'}</Button> : null}
            </div>
            {editor.template === 'custom' && advanced ? (
              <div className="roleadvanced">
                <label>
                  搜索业务权限
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：退款、库存、审批" />
                </label>
                <p>拒绝始终优先于允许。分类默认折叠；搜索时自动展开匹配结果。</p>
                {groups.length === 0 ? (
                  <div className="roleempty" role="status">
                    <strong>没有匹配结果</strong>
                    <span>可尝试“售后”“返款”等同义词。</span>
                  </div>
                ) : (
                  groups.map((group) => (
                    <details key={group.category} open={query.trim().length > 0}>
                      <summary>
                        <span>{group.name}</span>
                        <small>{group.permissions.length} 项</small>
                      </summary>
                      <div className="accessmatrix">
                        {group.permissions.map((permission) => {
                          const rule = editor.denies.includes(permission.code) ? 'deny' : editor.allows.includes(permission.code) ? 'allow' : 'inherit';
                          return (
                            <div className="accessmatrixrow" key={permission.code}>
                              <div>
                                <strong>{permissionText(permission.code)}</strong>
                                <small>
                                  {permissionRisk(permission)}
                                  {permission.makerChecker ? ' · 需要双人复核' : ''}
                                </small>
                                <TechnicalDetails facts={[{ label: '权限标识', value: <code>{permission.code}</code> }]} summary="查看技术标识" />
                              </div>
                              <select aria-label={`${permissionText(permission.code)}的授权规则`} value={rule} onChange={(event) => model.actions.permissionRule(permission.code, event.target.value as typeof rule)}>
                                <option value="inherit">不授予</option>
                                <option value="allow">允许</option>
                                <option value="deny">明确拒绝</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))
                )}
              </div>
            ) : (
              <p className="roletemplatehint">
                当前使用“{model.page?.templates.find((template) => template.code === editor.template)?.name ?? '自定义'}”模板。{editor.template === 'custom' ? '需要逐项配置时再打开高级权限。' : '如需逐项调整，请返回上一步选择“自定义”。'}
              </p>
            )}
          </section>
        ) : null}

        {editor.step === 3 ? <RoleReview model={model} /> : null}

        {editor.step < 3 ? (
          <footer>
            <Button onPress={model.actions.close}>稍后继续</Button>
            {editor.step > 1 ? <Button onPress={() => model.actions.roleStep((editor.step - 1) as 1 | 2)}>上一步</Button> : null}
            <Button type="submit" tone="primary">
              下一步
            </Button>
          </footer>
        ) : null}
      </form>
    </Dialog>
  );
}
