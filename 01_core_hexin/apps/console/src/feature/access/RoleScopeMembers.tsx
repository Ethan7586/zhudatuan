import { ApiError } from '@shop/sdk';
import { Badge, Button, Surface } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { scopeDisplayName, scopeKindLabel } from '../../entity/session/ScopePresentation';
import { safeQueryError } from '../../shared/api/QueryState';
import { deleteAccessRole, roleCommandAvailable, saveAccessRoleAssignment, verifyAccessRoleAssignment,
  verifyAccessRoleDelete, type AccessRoleAssignmentDraft } from './AccessRoleCommand';
import type { AccessMembership, AccessRole, AccessRoleMember } from './AccessSchema';

export function RoleScopeMembers({ context, role, members, onRefresh, onNotice, onDeleted }: Readonly<{
  context: ConsoleContext;
  role: AccessRole;
  members: readonly AccessMembership[];
  onRefresh: () => Promise<Readonly<{ roles: readonly AccessRole[]; items: readonly AccessMembership[] }>>;
  onNotice: (notice: string) => void;
  onDeleted: () => void;
}>) {
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const [scopeSource, setScopeSource] = useState<'direct' | 'inherited'>('direct');
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>();
  const [deleteArmed, setDeleteArmed] = useState(false);
  const seniorGovernanceRole = role.governance_level === 'senior_administrator';
  const assignableMembers = useMemo(() => seniorGovernanceRole
    ? members.filter((member) => !member.roles.some(({ role: roleId }) => roleId === 'role-platform-owner-v2'))
    : members, [members, seniorGovernanceRole]);
  const selectedMember = assignableMembers.find(({ id }) => id === selectedMemberId) ?? assignableMembers[0];
  const directScopes = useMemo(() => uniqueScopes([context.scope, ...context.scopes].filter((scope) => seniorGovernanceRole
    ? scope.kind === 'tenant' && scope.id === context.session.governance?.organization
    : withinScope(context.scope, scope))), [context.scope, context.scopes, context.session.governance?.organization, seniorGovernanceRole]);
  const inheritedScopes = useMemo(() => selectedMember === undefined ? [] : uniqueScopes(selectedMember.scopes
    .filter(({ effect }) => effect === 'allow')
    .map(({ kind, scope }) => ({ kind, id: scope })))
    .filter((scope) => directScopes.some((candidate) => scopeKey(candidate) === scopeKey(scope))), [directScopes, selectedMember]);
  const scopeOptions = scopeSource === 'direct' ? directScopes : inheritedScopes;
  const selectedScope = scopeOptions.find((scope) => scopeKey(scope) === selectedScopeKey) ?? scopeOptions[0];
  const canWriteRole = role.editable && roleCommandAvailable(context);
  const canManageSeniorRole = seniorGovernanceRole && context.session.governance?.exactOwner === true;
  const canAssign = (canWriteRole || (canManageSeniorRole && roleCommandAvailable(context)))
    && context.session.permissions.includes('access.scope.manage');

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (selectedMember === undefined || selectedScope === undefined) throw new Error('ACCESS_ASSIGNMENT_SELECTION_REQUIRED');
      const draft: AccessRoleAssignmentDraft = { action: 'assign', role: role.id, membership: selectedMember.id,
        scope: selectedScope, scopeSource, accessVersion: selectedMember.access_version };
      const receipt = await saveAccessRoleAssignment(context, draft);
      const reread = await onRefresh();
      return { member: verifyAccessRoleAssignment(draft, receipt, selectedMember, reread.roles, reread.items), receipt };
    },
    onSuccess: ({ member, receipt }) => {
      setAssignmentOpen(false);
      onNotice(seniorGovernanceRole
        ? `${member.display_name} 已升级为高级管理员；角色、权限、Scope 与 Access Version v${receipt.access_version} 已重读核对，商城会员身份未改动。`
        : `“${role.name}”已分配给 ${member.display_name}，${scopeSourceLabel(receipt.scope_source)} ${scopeLabel(receipt.scope)}；成员、身份、权限与 Access Version v${receipt.access_version} 已重读核对。`);
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async (assignment: AccessRoleMember) => {
      const before = members.find(({ id }) => id === assignment.membership);
      if (before === undefined) throw new Error('ACCESS_MEMBER_REREAD_UNAVAILABLE');
      const draft: AccessRoleAssignmentDraft = { action: 'revoke', role: role.id, membership: assignment.membership,
        scope: assignment.scope, scopeSource: assignment.scope_source, accessVersion: before.access_version };
      const receipt = await saveAccessRoleAssignment(context, draft);
      const reread = await onRefresh();
      verifyAccessRoleAssignment(draft, receipt, before, reread.roles, reread.items);
      return { assignment, receipt };
    },
    onSuccess: ({ assignment, receipt }) => onNotice(seniorGovernanceRole
      ? `${assignment.display_name} 已降级为普通管理员；高级角色与对应 Scope 已撤销，其他管理员角色及商城会员身份保持不变；Access Version v${receipt.access_version} 已重读核对。`
      : `已撤销 ${assignment.display_name} 的“${role.name}”身份（${scopeLabel(assignment.scope)}），其他身份与成员账户保持不变；Access Version v${receipt.access_version} 已重读核对。`),
  });
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const receipt = await deleteAccessRole(context, role);
      const reread = await onRefresh();
      verifyAccessRoleDelete(role, receipt, reread.roles, reread.items);
      return receipt;
    },
    onSuccess: () => {
      onNotice(`“${role.name}”的成员关系已解除，身份已删除；成员账户与其他身份保持不变，并已通过正式接口重读核对。`);
      onDeleted();
    },
  });
  const pending = assignMutation.isPending || revokeMutation.isPending || deleteMutation.isPending;
  const error = commandError(assignMutation.error ?? revokeMutation.error ?? deleteMutation.error);
  const duplicate = selectedMember !== undefined && selectedScope !== undefined
    && role.members.some((member) => member.membership === selectedMember.id && member.scope.id === selectedScope.id);

  return <div className="rolescopemembers">
    <Surface className="rolescopesummary" depth="flat" padding="default" radius="large">
      <header><div><p>管理范围</p><strong>{role.scopes.length} 个生效范围</strong></div><Badge tone="info">范围与成员</Badge></header>
      {role.scopes.length === 0 ? <span>尚未分配范围；每次成员分配都必须直接指定或继承明确范围。</span> : (
        <ul>{role.scopes.map((item) => <li key={`${scopeKey(item.scope)}:${item.source}`}>
          <span>{scopeLabel(item.scope)}</span><small>{scopeSourceLabel(item.source)} · {item.member_count} 位成员</small>
        </li>)}</ul>
      )}
    </Surface>

    <Surface className="roleassignedmembers" depth="flat" padding="default" radius="large">
      <header><div><p>已分配成员</p><strong>{role.member_count} 位</strong></div>
        <Button type="button" size="compact" isDisabled={!canAssign || pending || assignableMembers.length === 0}
          onPress={() => { setAssignmentOpen((open) => !open); setDeleteArmed(false); assignMutation.reset(); }}>
          {assignmentOpen ? '收起操作' : seniorGovernanceRole ? '升级为高级管理员' : '＋ 分配成员'}
        </Button>
      </header>
      {role.members.length === 0 ? <span>当前范围内尚未分配成员。</span> : <ul>{role.members.map((assignment) => (
        <li key={`${assignment.membership}:${scopeKey(assignment.scope)}`}>
          <div><strong>{assignment.display_name}</strong><small>{assignment.employee_no ?? '未设置员工号'} · Access v{assignment.access_version}</small></div>
          <div><Badge tone={assignment.scope_source === 'direct' ? 'info' : 'neutral'}>{scopeSourceLabel(assignment.scope_source)}</Badge>
            <small>{scopeLabel(assignment.scope)}</small></div>
          <Button type="button" tone="quiet" size="compact" isDisabled={!canAssign || pending}
            onPress={() => { revokeMutation.reset(); deleteMutation.reset(); revokeMutation.mutate(assignment); }}>
            {seniorGovernanceRole ? '降级为普通管理员' : '撤销'}
          </Button>
        </li>
      ))}</ul>}
    </Surface>

    {assignmentOpen ? <div className="roleassignmentform">
      <strong>{seniorGovernanceRole ? '选择要升级的普通管理员' : `分配“${role.name}”`}</strong>
      <label>成员<select value={selectedMember?.id ?? ''} disabled={pending || assignableMembers.length === 0}
        onChange={(event) => { setSelectedMemberId(event.target.value); setSelectedScopeKey(undefined); assignMutation.reset(); }}>
        {assignableMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.roles.length} 个身份</option>)}
      </select></label>
      <label>范围来源<select value={scopeSource} disabled={pending} onChange={(event) => {
        setScopeSource(event.target.value as 'direct' | 'inherited'); setSelectedScopeKey(undefined); assignMutation.reset();
      }}><option value="direct">直接指定</option><option value="inherited">继承成员已有范围</option></select></label>
      <label>生效范围<select value={selectedScope === undefined ? '' : scopeKey(selectedScope)} disabled={pending || scopeOptions.length === 0}
        onChange={(event) => { setSelectedScopeKey(event.target.value); assignMutation.reset(); }}>
        {scopeOptions.map((scope) => <option key={scopeKey(scope)} value={scopeKey(scope)}>{scopeLabel(scope)}</option>)}
      </select></label>
      {scopeSource === 'inherited' && inheritedScopes.length === 0 ? <p role="status">该成员没有可继承的明确范围，请改为直接指定。</p> : null}
      {duplicate ? <p role="status">该成员已在此范围拥有当前身份，无需重复分配。</p> : null}
      <Button type="button" tone="primary" isPending={assignMutation.isPending}
        isDisabled={!canAssign || pending || duplicate || selectedMember === undefined || selectedScope === undefined}
        onPress={() => assignMutation.mutate()}>{seniorGovernanceRole ? '确认升级并重读' : '确认分配并重读'}</Button>
    </div> : null}

    {!canAssign && (role.editable || seniorGovernanceRole) ? <p className="rolescopepermission" role="status">
      {seniorGovernanceRole ? '只有当前唯一 Owner 可以升级或降级高级管理员。' : '当前会话缺少身份与范围的完整管理能力；成员关系保持只读。'}
    </p> : null}
    {error === undefined ? null : <div className="roleassignmenterror" data-kind={error.kind} role="alert"><strong>{error.title}</strong><p>{error.detail}</p></div>}

    {role.editable ? <div className="roledelete">
      <Button type="button" tone="danger" isDisabled={!canWriteRole || pending} onPress={() => {
        assignMutation.reset(); revokeMutation.reset(); deleteMutation.reset();
        if (deleteArmed) deleteMutation.mutate(); else setDeleteArmed(true);
      }}>{deleteMutation.isPending ? '正在解除关系并重读…' : deleteArmed ? `确认删除“${role.name}”` : '删除身份'}</Button>
      <small>{deleteArmed ? `将只解除 ${role.member_count} 位成员与此身份的关系，不删除任何成员账户。再次点击确认。` : '删除身份前会先解除该身份的成员关系。'}</small>
    </div> : null}
  </div>;
}

function uniqueScopes(scopes: readonly ConsoleScope[]): ConsoleScope[] {
  return [...new Map(scopes.map((scope) => [scopeKey(scope), scope] as const)).values()];
}

function withinScope(parent: ConsoleScope, candidate: ConsoleScope): boolean {
  return scopeKey(parent) === scopeKey(candidate)
    || candidate.path?.some((ancestor) => ancestor.kind === parent.kind && ancestor.id === parent.id) === true;
}

function scopeKey(scope: Pick<ConsoleScope, 'kind' | 'id'>): string {
  return `${scope.kind}:${scope.id}`;
}

function scopeLabel(scope: Pick<ConsoleScope, 'kind' | 'id' | 'name'>): string {
  return `${scopeKindLabel(scope.kind)} · ${scopeDisplayName(scope)}`;
}

function scopeSourceLabel(source: 'direct' | 'inherited'): string {
  return source === 'direct' ? '直接指定' : '继承来源';
}

function commandError(error: Error | null): Readonly<{
  kind: 'conflict' | 'network' | 'denied' | 'verification' | 'failure'; title: string; detail: string;
}> | undefined {
  if (error === null) return undefined;
  if (error instanceof ApiError && error.status === 403) return { kind: 'denied', title: '无权修改范围与成员', detail: '服务端拒绝了本次操作，现有持久化关系未被页面改写。' };
  if (error instanceof ApiError && (error.status === 409 || error.status === 412 || error.code === 'VERSION_CONFLICT')) return { kind: 'conflict', title: '版本冲突', detail: '成员或身份已被其他操作更新；本次操作不视为成功，请重读后再试。' };
  if (error.message.includes('VERIFICATION_FAILED')) return { kind: 'verification', title: '保存回读核对失败', detail: '成员、身份、权限或 Access Version 未通过正式重读核对，本次操作不显示为持久化成功。' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'network', title: '网络错误', detail: '网络不可用，本次操作没有持久化成功。' };
  return { kind: 'failure', title: '范围或成员操作失败', detail: `${safeQueryError(error) ?? 'REQUEST_FAILED'}；现有持久化结果未被临时状态替代。` };
}
