import { Button } from '@shop/design';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { MemberInvitationDialog } from '../member/MemberInvitationDialog';
import { memberInvitationAvailable } from '../member/MemberInvitationCommand';
import { memberKey, readMembers } from '../member/MemberQuery';
import { MemberRegistrationResetDialog } from '../member/MemberRegistrationResetDialog';
import type { Member } from '../member/MemberSchema';
import { accessKey, readAccess } from './AccessQuery';
import type { AccessMembership } from './AccessSchema';
import { AccessWorkspaceTabs } from './AccessWorkspaceTabs';
import './member-access-workspace.css';

export type MemberAccessPrimary = 'access' | 'members';

interface MemberAccessRow {
  readonly id: string;
  readonly member?: Member;
  readonly access?: AccessMembership;
}

export function MemberAccessWorkspace({ primary }: { readonly primary: MemberAccessPrimary }) {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState('');
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member>();
  const cursor = search.get('cursor') ?? undefined;
  const canReadAccess = primary === 'access' || hasOperation(context, 'access.center.read');
  const canReadMembers = primary === 'members' || hasOperation(context, 'member.members.read');
  const accessCursor = primary === 'access' ? cursor : undefined;
  const memberCursor = primary === 'members' ? cursor : undefined;
  const accessQuery = useQuery({
    queryKey: accessKey(context, accessCursor),
    queryFn: ({ signal }) => readAccess(context, accessCursor, signal),
    enabled: canReadAccess,
    placeholderData: keepPreviousData,
  });
  const memberQuery = useQuery({
    queryKey: memberKey(context, memberCursor),
    queryFn: ({ signal }) => readMembers(context, memberCursor, signal),
    enabled: canReadMembers,
    placeholderData: keepPreviousData,
  });
  const accessItems = accessQuery.data?.items ?? [];
  const memberItems = memberQuery.data?.items ?? [];
  const rows = useMemo(() => mergeRows(memberItems, accessItems, primary), [accessItems, memberItems, primary]);
  const normalizedFilter = filter.trim().toLocaleLowerCase('zh-CN');
  const visibleRows = useMemo(() => rows.filter((row) => normalizedFilter === '' || rowSearchText(row).includes(normalizedFilter)), [normalizedFilter, rows]);
  const activeSelectedId = visibleRows.some((row) => row.id === selectedId) ? selectedId : visibleRows[0]?.id;
  const selected = rows.find((row) => row.id === activeSelectedId);
  const primaryData = primary === 'access' ? accessQuery.data : memberQuery.data;
  const primaryPending = primary === 'access' ? accessQuery.isPending : memberQuery.isPending;
  const primaryFetching = primary === 'access' ? accessQuery.isFetching : memberQuery.isFetching;
  const primaryError = safeQueryError(primary === 'access' ? accessQuery.error : memberQuery.error);
  const secondaryError = safeQueryError(primary === 'access' ? memberQuery.error : accessQuery.error);
  const invitationEnabled = memberInvitationAvailable(context);
  const resetAvailable = context.session.permissions.includes('identity.registration.reset') && context.session.capabilities.includes('identity.members.reset') && context.session.csrf !== undefined;
  const roleCount = useMemo(() => new Set(rows.flatMap((row) => row.access?.roles.map((role) => role.role) ?? [])).size, [rows]);
  const activeCount = rows.filter((row) => rowStatus(row) === 'active').length;
  const nextCursor = primaryData?.nextCursor;

  const refresh = () => {
    if (canReadAccess) void accessQuery.refetch();
    if (canReadMembers) void memberQuery.refetch();
  };

  return (
    <>
      <section className="memberaccessworkspace" aria-labelledby="memberaccessworkspacetitle">
        <header className="memberaccesshero">
          <div>
            <span>MEMBERSHIP · RBAC · DATA SCOPE</span>
            <h1 id="memberaccessworkspacetitle">会员与权限控制中心</h1>
            <p>成员资料、角色叠加、明确禁止、数据范围、Owner 保护与授权审计统一管理</p>
          </div>
          <div className="memberaccessheroactions">
            {primary === 'access' ? (
              <Button
                className="memberaccesssecondary"
                onPress={() => {
                  void navigate(scopePath(context.scope, 'settings/members'));
                }}
              >
                成员管理与邀请码
              </Button>
            ) : null}
            {invitationEnabled ? (
              <Button className="memberaccessprimary" tone="primary" onPress={() => setInvitationOpen(true)}>
                生成管理员邀请码
              </Button>
            ) : null}
            <Button className="memberaccessrefresh" onPress={refresh}>
              刷新
            </Button>
          </div>
        </header>

        <AccessWorkspaceTabs current="members" />

        {primaryPending && primaryData === undefined ? <WorkspaceState text="正在读取真实会员与授权关系…" /> : null}
        {primaryError !== undefined && primaryData === undefined ? <WorkspaceState tone="danger" text={primaryError} action={refresh} /> : null}
        {primaryData !== undefined ? (
          <>
            <section className="memberaccessmetrics" aria-label="会员权限摘要">
              <Metric label="会员身份" value={memberQuery.data?.count ?? accessQuery.data?.count ?? rows.length} />
              <Metric label="当前有效" value={activeCount} />
              <Metric label="已分配角色" value={roleCount} />
            </section>

            {secondaryError === undefined ? null : (
              <section className="memberaccessnotice" role="status">
                <strong>补充资料暂不可用</strong>
                <span>{secondaryError}；主页面数据仍可查看。</span>
              </section>
            )}

            <div className="memberaccesslayout">
              <section className="memberaccessroster" role="table" aria-label="成员管理" aria-busy={primaryFetching}>
                <div className="memberaccesssearch">
                  <label htmlFor="memberaccessfilter">搜索成员、员工号或角色</label>
                  <input id="memberaccessfilter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索姓名、账号或角色" />
                </div>
                <div className="memberaccessrows" role="rowgroup">
                  {visibleRows.length === 0 ? (
                    <p className="memberaccessempty">没有匹配的成员</p>
                  ) : (
                    visibleRows.map((row) => (
                      <div key={row.id} role="row">
                        <div role="cell">
                          <button type="button" className="memberaccessrow" data-selected={row.id === activeSelectedId || undefined} aria-current={row.id === activeSelectedId ? 'true' : undefined} onClick={() => setSelectedId(row.id)}>
                            <span className="memberaccessrowtop">
                              <strong>{rowName(row)}</strong>
                              <Status value={rowStatus(row)} />
                            </span>
                            <span className="memberaccessrowmeta">
                              {row.member?.employee_no ?? row.id} · {clientLabel(row.member?.client)}
                            </span>
                            <span className="memberaccessrowtags">
                              {isOwner(row) ? <Tag tone="owner">OWNER</Tag> : null}
                              {isSelf(row, context) ? <Tag tone="self">本人</Tag> : null}
                              {(row.access?.roles ?? []).map((role) => (
                                <Tag key={role.role}>{role.name}</Tag>
                              ))}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <footer className="memberaccesspagination">
                  <span>本页 {primaryData.count} 条</span>
                  <Button
                    size="compact"
                    isDisabled={nextCursor === undefined || primaryFetching}
                    onPress={() => {
                      if (nextCursor !== undefined) setSearch(pageCursor(search, nextCursor), { preventScrollReset: true });
                    }}
                  >
                    {primaryFetching ? '加载中…' : '下一页'}
                  </Button>
                </footer>
              </section>

              <section className="memberaccessdetail" aria-label="成员权限详情">
                {selected === undefined ? <WorkspaceState text="请选择会员身份" /> : <MemberDetail row={selected} context={context} resetAvailable={resetAvailable} onReset={setResetTarget} />}
              </section>
            </div>
          </>
        ) : null}
      </section>
      <MemberInvitationDialog context={context} open={invitationOpen} onClose={() => setInvitationOpen(false)} />
      <MemberRegistrationResetDialog
        context={context}
        target={resetTarget}
        onClose={() => setResetTarget(undefined)}
        onReset={() => {
          void memberQuery.refetch();
        }}
        onInvite={() => setInvitationOpen(true)}
      />
    </>
  );
}

function MemberDetail({ row, context, resetAvailable, onReset }: { readonly row: MemberAccessRow; readonly context: ConsoleContext; readonly resetAvailable: boolean; readonly onReset: (member: Member) => void }) {
  const roles = row.access?.roles ?? [];
  const scopes = row.access?.scopes ?? [];
  const allowScopes = scopes.filter((scope) => scope.effect === 'allow');
  const denyScopes = scopes.filter((scope) => scope.effect === 'deny');
  const version = row.access?.access_version ?? row.member?.access_version;
  const canReset = resetAvailable && row.member?.reset_allowed === true;
  return (
    <>
      <header className="memberaccessdetailheader">
        <div>
          <span className="memberaccessdetailtitle">
            <h2>{rowName(row)}</h2>
            {isOwner(row) ? <b>OWNER</b> : null}
          </span>
          <p>
            {row.member?.employee_no ?? row.id} · 权限版本 v{version ?? '—'} · {roles.length} 个角色
          </p>
        </div>
        {canReset && row.member !== undefined ? (
          <Button className="memberaccessdanger" tone="danger" onPress={() => onReset(row.member as Member)}>
            重置注册身份
          </Button>
        ) : null}
      </header>

      <div className="memberaccessdetailscroll">
        <section className="memberaccessfacts" aria-label="成员资料">
          <Fact label="成员关系" value={row.id} />
          <Fact label="身份端" value={clientLabel(row.member?.client)} />
          <Fact label="登录身份" value={row.member === undefined ? '未加载' : row.member.login_identity_bound ? '已绑定' : '未绑定'} />
          <Fact label="档案状态" value={row.member?.status ?? '未加载'} />
          <Fact label="成员状态" value={row.member?.membership_status ?? row.access?.status ?? '未知'} />
          <Fact label="授权关系" value={row.access?.status ?? '未加载'} />
          <Fact label="加入时间" value={formatDate(row.member?.joined_at ?? null)} />
        </section>

        <section className="memberaccesssection">
          <SectionTitle title="角色模板" hint="多个角色叠加授权" />
          {roles.length === 0 ? (
            <p className="memberaccessempty">当前接口没有返回已分配角色</p>
          ) : (
            <div className="memberaccessrolegrid">
              {roles.map((role) => (
                <label key={role.role} className="memberaccessrolecard">
                  <input type="checkbox" checked readOnly aria-label={`${role.name} 已分配`} />
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.role}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="memberaccesssection">
          <SectionTitle title="数据范围" hint="权限只在所选资源内生效" />
          <div className="memberaccessscopebox">
            {allowScopes.length === 0 ? (
              <p className="memberaccessempty">当前没有允许范围</p>
            ) : (
              allowScopes.map((scope) => (
                <span className="memberaccessscope" key={scope.id}>
                  <b>{scopeKindLabel(scope.kind)}</b>
                  {scope.scope}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="memberaccesssection">
          <SectionTitle title="明确禁止" hint="禁止优先于任何角色与范围允许" />
          <div className="memberaccessdenybox">
            {denyScopes.length === 0 ? (
              <p className="memberaccessempty">没有显式拒绝</p>
            ) : (
              denyScopes.map((scope) => (
                <span className="memberaccessdeny" key={scope.id}>
                  <b>{scopeKindLabel(scope.kind)}</b>
                  {scope.scope}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="memberaccessboundary" aria-labelledby="memberaccessboundarytitle">
          <strong id="memberaccessboundarytitle">授权变更保持关闭</strong>
          <p>当前真实能力全部保留；角色与 Scope 变更缺 Preview、Step-up、expectedVersion 和重读回执时不执行。</p>
          {row.member?.reset_block_reason === null || row.member?.reset_block_reason === undefined ? null : <small>注册重置限制：{row.member.reset_block_reason}</small>}
          {isSelf(row, context) ? <small>这是当前登录身份。</small> : null}
        </section>
      </div>
    </>
  );
}

function mergeRows(members: readonly Member[], access: readonly AccessMembership[], primary: MemberAccessPrimary): readonly MemberAccessRow[] {
  const memberById = new Map(members.map((member) => [member.membership_id, member]));
  const accessById = new Map(access.map((membership) => [membership.id, membership]));
  const primaryIds = primary === 'members' ? members.map((member) => member.membership_id) : access.map((membership) => membership.id);
  return [...new Set(primaryIds)].map((id) => {
    const member = memberById.get(id);
    const membership = accessById.get(id);
    return { id, ...(member === undefined ? {} : { member }), ...(membership === undefined ? {} : { access: membership }) };
  });
}

function hasOperation(context: ConsoleContext, operation: string): boolean {
  return context.session.capabilities.includes(operation) || context.session.permissions.includes(operation);
}

function rowSearchText(row: MemberAccessRow): string {
  return [row.id, row.member?.display_name, row.member?.employee_no, ...(row.access?.roles.map((role) => role.name) ?? [])]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('zh-CN');
}

function rowName(row: MemberAccessRow): string {
  return row.member?.display_name ?? row.id;
}
function rowStatus(row: MemberAccessRow): string {
  return row.member?.membership_status ?? row.access?.status ?? row.member?.status ?? 'unknown';
}
function isOwner(row: MemberAccessRow): boolean {
  return (row.access?.roles ?? []).some((role) => /owner/i.test(`${role.role} ${role.name}`));
}
function isSelf(row: MemberAccessRow, context: ConsoleContext): boolean {
  return row.id === context.session.membership || row.member?.membership_id === context.session.membership;
}
function clientLabel(client?: Member['client']): string {
  return client === 'operator' ? '后台' : client === 'storefront' ? '购物端' : client === 'store' ? '门店端' : client === 'supplier' ? '供应商端' : '后台';
}
function scopeKindLabel(kind: string): string {
  return ({ platform: '平台', tenant: '商户', distributor: '分销', enterprise: '集团', mall: '商城', supplier: '供应商', brand: '品牌', store: '门店', department: '部门', self: '本人' } as Record<string, string>)[kind] ?? kind;
}

function Metric({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <i aria-hidden="true" />
    </article>
  );
}
function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function SectionTitle({ title, hint }: { readonly title: string; readonly hint: string }) {
  return (
    <header className="memberaccesssectiontitle">
      <h3>{title}</h3>
      <span>{hint}</span>
    </header>
  );
}
function Tag({ children, tone = 'default' }: { readonly children: string; readonly tone?: 'default' | 'owner' | 'self' }) {
  return (
    <span className="memberaccesstag" data-tone={tone}>
      {children}
    </span>
  );
}
function Status({ value }: { readonly value: string }) {
  return (
    <span className="memberaccessstatus" data-status={value}>
      {statusLabel(value)}
    </span>
  );
}
function statusLabel(value: string): string {
  return ({ active: '有效', invited: '待激活', suspended: '已暂停', offboarded: '已移除', expired: '已过期' } as Record<string, string>)[value] ?? value;
}
function WorkspaceState({ text, tone = 'default', action }: { readonly text: string; readonly tone?: 'default' | 'danger'; readonly action?: () => void }) {
  return (
    <section className="memberaccessstate" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{text}</strong>
      {action === undefined ? null : <Button onPress={action}>重试</Button>}
    </section>
  );
}
