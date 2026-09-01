import { Badge, Button, MasterDetail, MasterItem, Surface, WorkspaceHero } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { safeQueryError } from '../../shared/api/QueryState';
import { MemberInvitationDialog } from '../member/MemberInvitationDialog';
import { accessKey, readAccess } from './AccessQuery';
import type { AccessRole } from './AccessSchema';
import { roleCommandAvailable } from './AccessRoleCommand';
import { AccessWorkspaceTabs } from './AccessWorkspaceTabs';
import { RoleEditor, type RoleEditorRecord } from './RoleEditor';
import './role-access-workspace.css';

export function RoleAccessWorkspace() {
  const context = useConsoleContext();
  const [search] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>();
  const [draftId, setDraftId] = useState<string>();
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState<string>();
  const [invitationOpen, setInvitationOpen] = useState(false);
  const canRead = context.session.permissions.includes('access.center.read');
  const canWrite = roleCommandAvailable(context);
  const invitationAvailable = context.session.permissions.includes('identity.invitation.manage')
    && context.session.capabilities.includes('identity.invitations.create')
    && context.session.csrf !== undefined;
  const query = useQuery({
    queryKey: accessKey(context),
    queryFn: ({ signal }) => readAccess(context, undefined, signal),
    enabled: canRead,
  });
  const section = search.get('section') === 'invitations' ? 'invitations' : 'roles';
  const roles = query.data?.roles ?? [];
  const normalizedFilter = filter.trim().toLocaleLowerCase('zh-CN');
  const visibleRoles = useMemo(() => roles.filter((role) => normalizedFilter === ''
    || `${role.name} ${role.id} ${role.permissions.join(' ')}`.toLocaleLowerCase('zh-CN').includes(normalizedFilter)), [normalizedFilter, roles]);
  const defaultRole = visibleRoles.find(({ governance }) => !governance) ?? visibleRoles[0];
  const selectedRole = roles.find(({ id }) => id === selectedId) ?? defaultRole;
  const editorRecord = draftId === undefined ? (selectedRole === undefined ? undefined : toEditorRecord(selectedRole)) : newRoleDraft(draftId);

  const refresh = async () => {
    setNotice(undefined);
    const result = await query.refetch();
    if (result.data === undefined) throw result.error ?? new Error('ACCESS_ROLE_REREAD_FAILED');
    return result.data.roles;
  };

  return (
    <section className="roleaccessworkspace" aria-label="自定义身份与权限工作台">
      <WorkspaceHero
        className="roleaccesshero"
        eyebrow="MEMBERS & PERMISSIONS · CUSTOM IDENTITY"
        title="会员与权限"
        description="像 Discord 一样先命名自定义身份，再从权威目录自由组合跨功能权限。"
        actions={invitationAvailable ? <Button tone="primary" onPress={() => setInvitationOpen(true)}>邀请新成员</Button> : undefined}
      />

      <Surface className="roleaccessprinciple" depth="flat" padding="default" radius="large">
        <span aria-hidden="true">✓</span>
        <div><strong>身份是权限容器，不是固定职位</strong><p>名称由商户自由定义；名称不产生权限，权限也不会自动改名。范围与成员分配留在 IAM-003。</p></div>
      </Surface>

      <AccessWorkspaceTabs current={section} />

      {section === 'invitations' ? (
        <InvitationRecordsPanel available={invitationAvailable} onInvite={() => setInvitationOpen(true)} />
      ) : !canRead ? (
        <WorkspaceState tone="denied" title="无权读取身份目录" detail="当前会话没有 access.center.read 权限。" />
      ) : query.isPending && query.data === undefined ? (
        <WorkspaceState title="正在加载身份与权限目录…" detail="正在读取正式 access.center.read 契约。" />
      ) : query.error !== null && query.data === undefined ? (
        <WorkspaceState tone="danger" title={queryErrorTitle(query.error)} detail={safeQueryError(query.error) ?? 'REQUEST_FAILED'} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {notice === undefined ? null : <p className="roleaccessnotice" role="status">{notice}</p>}
          <MasterDetail
            className="roleaccessmasterdetail"
            masterLabel="身份列表"
            detailLabel="身份名称与功能权限"
            master={
              <RoleDirectory
                roles={visibleRoles}
                total={roles.length}
                selectedId={editorRecord?.id}
                draftId={draftId}
                filter={filter}
                canWrite={canWrite}
                onFilter={setFilter}
                onSelect={(id) => { setDraftId(undefined); setSelectedId(id); setNotice(undefined); }}
                onCreate={() => { const id = `role:${crypto.randomUUID()}`; setDraftId(id); setSelectedId(undefined); setNotice(undefined); }}
              />
            }
            detail={editorRecord === undefined ? (
              <WorkspaceState title={roles.length === 0 ? '暂无自定义身份' : '没有匹配的身份'} detail={canWrite ? '可从左侧新建一个名称自由、权限为空的自定义身份。' : '当前会话只能读取身份目录。'} />
            ) : (
              <RoleEditor
                key={`${editorRecord.id}:${editorRecord.version ?? 'draft'}`}
                context={context}
                role={editorRecord}
                onRefresh={refresh}
                onEdit={() => setNotice(undefined)}
                onSaved={(saved) => {
                  setDraftId(undefined);
                  setSelectedId(saved.id);
                  setNotice(`“${saved.name}”已保存，并已通过正式接口重读核对名称、权限与版本 v${saved.version}。`);
                }}
              />
            )}
          />
        </>
      )}
      <MemberInvitationDialog context={context} open={invitationOpen} onClose={() => setInvitationOpen(false)} />
    </section>
  );
}

function RoleDirectory({ roles, total, selectedId, draftId, filter, canWrite, onFilter, onSelect, onCreate }: Readonly<{
  roles: readonly AccessRole[];
  total: number;
  selectedId?: string | undefined;
  draftId?: string | undefined;
  filter: string;
  canWrite: boolean;
  onFilter: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}>) {
  const governance = roles.filter(({ governance: value }) => value);
  const custom = roles.filter(({ governance: value }) => !value);
  return <div className="roledirectory">
    <header><div><h2>身份列表</h2><p>治理身份与业务身份分区显示</p></div><Badge tone="neutral">{total} 个</Badge></header>
    <label className="roledirectorysearch">搜索身份或权限
      <input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="搜索身份或权限代码" />
    </label>
    <RoleGroup title="治理身份" empty={governance.length === 0 ? '当前范围未返回治理身份' : undefined}>
      {governance.map((role) => <RoleItem key={role.id} role={role} selected={role.id === selectedId} onSelect={onSelect} />)}
    </RoleGroup>
    <RoleGroup title="自定义业务身份" empty={draftId === undefined && custom.length === 0 ? '尚未创建自定义业务身份' : undefined}>
      {draftId === undefined ? null : <MasterItem selected title="未保存的新身份" description="名称与权限均为本地草稿" meta="0 项权限" trailing={<Badge tone="warning">草稿</Badge>} />}
      {custom.map((role) => <RoleItem key={role.id} role={role} selected={role.id === selectedId} onSelect={onSelect} />)}
    </RoleGroup>
    <Button className="roledirectorycreate" isDisabled={!canWrite} onPress={onCreate}>＋ 新建自定义身份</Button>
    {!canWrite ? <p className="roledirectoryhint">当前会话无身份写入权限；读取结果仍保持可见。</p> : <p className="roledirectoryhint">身份名称不会推断、勾选或限制任何权限。</p>}
  </div>;
}

function RoleGroup({ title, empty, children }: Readonly<{ title: string; empty?: string | undefined; children: ReactNode }>) {
  return <section className="roledirectorygroup"><h3>{title}</h3>{children}{empty === undefined ? null : <p>{empty}</p>}</section>;
}

function RoleItem({ role, selected, onSelect }: Readonly<{ role: AccessRole; selected: boolean; onSelect: (id: string) => void }>) {
  return <MasterItem
    selected={selected}
    title={role.name}
    description={`${role.permissions.length} 项权限 · ${role.member_count} 位成员`}
    meta={`版本 v${role.version}`}
    leading={<span className="roleavatar" aria-hidden="true">{role.name.slice(0, 1)}</span>}
    trailing={<Badge tone={role.governance ? 'info' : 'neutral'}>{role.governance ? '治理' : '自定义'}</Badge>}
    onClick={() => onSelect(role.id)}
  />;
}

function InvitationRecordsPanel({ available, onInvite }: Readonly<{ available: boolean; onInvite: () => void }>) {
  return <Surface className="invitationrecordspanel" depth="low" padding="spacious" role="region" aria-labelledby="invitationrecordstitle">
    <p>INVITATION RECORDS</p><h2 id="invitationrecordstitle">邀请记录</h2>
    <strong>当前正式契约只提供邀请码创建能力，尚未提供邀请记录列表读取。</strong>
    <span>这里不会用模拟记录伪造闭环；现有真实邀请能力继续保留。</span>
    {available ? <Button tone="primary" onPress={onInvite}>生成管理员邀请码</Button> : <p role="status">当前会话没有生成邀请码的权限。</p>}
  </Surface>;
}

function WorkspaceState({ title, detail, tone = 'default', onRetry }: Readonly<{
  title: string;
  detail: string;
  tone?: 'default' | 'danger' | 'denied';
  onRetry?: () => void;
}>) {
  return <Surface className="roleaccessstate" data-tone={tone} depth="low" padding="spacious" role={tone === 'danger' ? 'alert' : 'status'}>
    <strong>{title}</strong><p>{detail}</p>{onRetry === undefined ? null : <Button onPress={onRetry}>重试</Button>}
  </Surface>;
}

function queryErrorTitle(error: Error): string {
  const status = Reflect.get(error, 'status');
  if (status === 403) return '无权读取身份目录';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return '网络不可用';
  return '身份目录读取失败';
}

function toEditorRecord(role: AccessRole): RoleEditorRecord {
  return { ...role, persisted: true };
}

function newRoleDraft(id: string): RoleEditorRecord {
  return { id, name: '', status: 'active', permissions: [], member_count: 0, governance: false, editable: true, persisted: false };
}
