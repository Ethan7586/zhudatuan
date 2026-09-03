import { chineseDomainLabel, chineseSectionLabel, hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { Button } from '@shop/design';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';

import type { DataColumn } from '../../../shared/ui/DataTable';
import { PagedResource } from '../../../shared/ui/PagedResource';
import { pageCursor } from '../../../shared/url/PageCursor';
import { accessKey, readAccess } from './AccessQuery';
import type { AccessMembership } from './AccessSchema';
import { executeAccessChange, type AccessChange } from './AccessCommand';
import type { AccessIntent } from './AccessDialog';
import './Access.css';

const AccessDialog = lazy(() => import('./AccessDialog').then((module) => ({ default: module.AccessDialog })));

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [intent, setIntent] = useState<AccessIntent>();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: accessKey(context, cursor), queryFn: ({ signal }) => readAccess(context, cursor, signal) });
  const data = query.data;
  const error = safeQueryError(query.error);
  const state = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 });
  const canRole = allowed(context, 'access.role.manage', 'access.roles.manage');
  const canOverride = allowed(context, 'access.override.manage', 'access.overrides.manage');
  const canScope = allowed(context, 'access.scope.manage', 'access.scopes.manage');
  const mutation = useMutation({
    mutationFn: (change: AccessChange) => executeAccessChange(context, change),
    onSuccess: async () => {
      setIntent(undefined);
      await queryClient.invalidateQueries({ queryKey: ['console', context.scope.kind, context.scope.id] });
    },
  });
  const mutationError = safeQueryError(mutation.error);
  const columns = useMemo<readonly DataColumn<AccessMembership>[]>(
    () => [
      {
        key: 'membership',
        label: '账号',
        render: (row) => (
          <div className="accessaccount">
            <strong>{row.display_name}</strong>
            <span>{accountLabel(row)}</span>
          </div>
        ),
      },
      { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
      { key: 'roles', label: '角色', render: (row) => <div className="accessroles">{row.roles.length ? row.roles.map((role) => <span key={role.role}>{chineseDomainLabel(role.name, role.name)}</span>) : '未分配'}</div> },
      { key: 'scopes', label: '项目范围', render: (row) => `${row.scopes.length} 项` },
      { key: 'overrides', label: '覆盖权限', render: (row) => `${row.overrides.length} 项` },
      { key: 'version', label: '权限版本', render: (row) => `第 ${row.access_version} 版` },
      {
        key: 'actions',
        label: '操作',
        render: (row) => {
          const customRole = row.roles.find((role) => role.kind === 'custom');
          return (
            <div className="accessactions">
              <Button tone="primary" onPress={() => setIntent({ kind: 'override', membership: row })} isDisabled={!canOverride || row.id === context.session.membership}>
                编辑权限
              </Button>
              <Button onPress={() => setIntent({ kind: 'scope', membership: row })} isDisabled={!canScope}>
                项目授权
              </Button>
              <Button onPress={() => customRole && setIntent({ kind: 'role', membership: row, role: customRole })} isDisabled={!canRole || customRole === undefined}>
                编辑角色
              </Button>
            </div>
          );
        },
      },
    ],
    [canOverride, canRole, canScope, context.session.membership]
  );
  if (hasFailureCode(query.error, 'STEPUP_REQUIRED')) {
    return <AssurancePrompt title="权限中心" description="管理员账号、角色和项目范围属于敏感信息。请先完成短信二次验证，成功后会自动返回并加载当前权限中心。" />;
  }
  return (
    <>
      <PagedResource
        title="权限中心"
        eyebrow={chineseSectionLabel('权限中心')}
        description="统一维护管理员角色、成员覆盖权限和项目范围；默认拒绝与显式拒绝始终优先。"
        condition={state}
        {...(error === undefined ? {} : { error })}
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        count={data?.count ?? 0}
        {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
        boundary={{ title: '关键授权已接入双人复核', message: '编辑权限、项目范围和自定义角色均要求高强度二次验证、当前版本、另一位管理员签发的一次性复核凭证、防重复提交与提交后权威回读；所有者角色只能通过所有权转移流程变更。' }}
        retry={() => {
          void query.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
      {intent === undefined ? null : (
        <Suspense fallback={<p role="status">正在打开安全复核…</p>}>
          <AccessDialog
            intent={intent}
            permissions={context.session.permissions}
            scopeKind={context.scope.kind}
            scopeResource={context.scope.id}
            makerMembership={context.session.membership}
            assurance={context.session.assurance.level}
            busy={mutation.isPending}
            {...(mutationError === undefined ? {} : { error: mutationError })}
            onClose={() => {
              if (!mutation.isPending) setIntent(undefined);
            }}
            onSubmit={(change) => mutation.mutate(change)}
          />
        </Suspense>
      )}
    </>
  );
}

function accountLabel(row: AccessMembership): string {
  if (row.employee_no) return `员工号 ${row.employee_no}`;
  if (row.mobile_masked && row.mobile_masked !== '***') return `手机 ${row.mobile_masked}`;
  return row.client === 'storefront' ? '商城账号' : '控制台账号';
}

function allowed(context: ReturnType<typeof useConsoleContext>, permission: string, capability: string): boolean {
  return context.session.permissions.includes(permission) && context.session.capabilities.includes(capability) && context.session.csrf !== undefined;
}
