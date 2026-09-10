import { Empty, ResourceState, type ResourceCondition } from '@shop/design';
import type {
  StorefrontMember,
  StorefrontMemberDetail,
  StorefrontMemberInvitee,
  StorefrontMemberOrder,
} from '@shop/contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopeDisplayName } from '../../entity/session/ScopePresentation';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { aftersaleLabel, fulfillmentLabel, paymentLabel } from '../order/OrderPresentation';
import { StorefrontMemberCustomProfile } from './StorefrontMemberCustomProfile';
import {
  readStorefrontMemberDetail,
  readStorefrontMemberInvitees,
  readStorefrontMemberOrders,
  readStorefrontMembers,
  storefrontMemberDetailKey,
  storefrontMemberInviteesKey,
  storefrontMemberKey,
  storefrontMemberOrdersKey,
} from './StorefrontMemberQuery';
import './storefront-member.css';

type MemberFilter = 'all' | 'wechat-bound' | 'wechat-unbound';
type MemberDetailTab = 'profile' | 'referrals' | 'orders';
interface MemberPageQuery<T> {
  readonly data: { readonly items: readonly T[]; readonly nextCursor?: string | undefined } | undefined;
  readonly error: Error | null;
  readonly isFetching: boolean;
  readonly refetch: () => Promise<unknown>;
}
type MemberIconName = 'close' | 'expand' | 'member' | 'mobile' | 'refresh' | 'search' | 'wechat';

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const q = search.get('q')?.trim().slice(0, 100) ?? '';
  const cursor = search.get('cursor') ?? undefined;
  const [draft, setDraft] = useState(q);
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [selectedMember, setSelectedMember] = useState<StorefrontMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const request = { ...(q === '' ? {} : { q }), ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({
    queryKey: storefrontMemberKey(context, request),
    queryFn: ({ signal }) => readStorefrontMembers(context, request, signal),
    placeholderData: keepPreviousData,
  });
  const error = safeQueryError(query.error);
  const condition = resourceState(query.data, query.isFetching, error);
  const mallName = scopeDisplayName(context.scope);
  const rows = query.data?.items ?? [];
  const visibleRows = rows.filter((member) => {
    if (filter === 'wechat-bound') return member.wechat_bound;
    if (filter === 'wechat-unbound') return !member.wechat_bound;
    return true;
  });

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    if (!detailOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailOpen]);

  const closeDetail = () => setDetailOpen(false);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(search);
    const normalized = draft.trim().slice(0, 100);
    if (normalized === '') next.delete('q');
    else next.set('q', normalized);
    next.delete('cursor');
    closeDetail();
    setSearch(next);
  };

  return (
    <section className="storefrontmembersworkspace" aria-labelledby="storefrontmembertitle">
      <header className="storefrontmemberhero">
        <div>
          <h1 id="storefrontmembertitle">商城会员</h1>
          <p>查看当前商城范围内的消费者与绑定状态</p>
        </div>
        <div className="storefrontmemberherometa">
          <span>当前商城 <strong>{mallName}</strong></span>
          <em>完整档案</em>
        </div>
      </header>

      <MemberOverview rows={rows} total={query.data?.count} />

      <div className="storefrontmemberstage" data-detail-open={detailOpen}>
        <section className="storefrontmemberpanel" aria-labelledby="storefrontmemberlisttitle">
          <header className="storefrontmemberpanelheading">
            <div>
              <h2 id="storefrontmemberlisttitle">会员目录</h2>
              <span>{query.data?.count ?? 0}</span>
            </div>
            <div className="storefrontmemberpanelactions">
              <IconButton
                label={query.isFetching ? '正在刷新会员名单' : '刷新会员名单'}
                icon="refresh"
                loading={query.isFetching}
                onPress={() => void query.refetch()}
              />
              {detailOpen ? <IconButton label="全屏查看会员目录" icon="expand" onPress={closeDetail} /> : null}
            </div>
          </header>

          <form className="storefrontmembersearch" role="search" onSubmit={submitSearch}>
            <label htmlFor="storefrontmembersearch">搜索商城会员</label>
            <MemberIcon name="search" />
            <input
              id="storefrontmembersearch"
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="搜索姓名或手机号后四位"
            />
            <button type="submit">搜索</button>
          </form>

          <div className="storefrontmemberfilters" aria-label="会员筛选">
            <FilterButton active={filter === 'all'} onPress={() => setFilter('all')}>全部会员</FilterButton>
            <FilterButton active={filter === 'wechat-bound'} onPress={() => setFilter('wechat-bound')}>微信已绑定</FilterButton>
            <FilterButton active={filter === 'wechat-unbound'} onPress={() => setFilter('wechat-unbound')}>微信未绑定</FilterButton>
          </div>

          <div className="storefrontmemberresource">
            {query.data !== undefined && visibleRows.length === 0 && error === undefined ? (
              <Empty
                title={q === '' && filter === 'all' ? '暂无数据' : '未找到匹配会员'}
                description={filter === 'all' ? '请检查姓名或脱敏手机号后四位。' : '当前页没有符合此绑定状态的会员。'}
              />
            ) : (
              <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={() => void query.refetch()} resourceLabel="商城会员名单">
                <MemberDirectory
                  rows={visibleRows}
                  selectedId={detailOpen ? selectedMember?.membership_id : undefined}
                  onSelect={(member) => {
                    setSelectedMember(member);
                    setDetailOpen(true);
                  }}
                />
              </ResourceState>
            )}
          </div>

          <footer className="storefrontmemberpagination">
            <span>当前页 {visibleRows.length} 位 · 共 {query.data?.count ?? 0} 位会员</span>
            <button
              type="button"
              disabled={query.data?.nextCursor === undefined || query.isFetching}
              onClick={() => {
                if (query.data?.nextCursor === undefined) return;
                closeDetail();
                setSearch(pageCursor(search, query.data.nextCursor));
              }}
            >
              {query.isFetching ? '加载中…' : '下一页'}
            </button>
          </footer>
        </section>

        <MemberDetail member={selectedMember} mallName={mallName} open={detailOpen} onClose={closeDetail} />
      </div>
    </section>
  );
}

function MemberOverview({ rows, total }: Readonly<{ rows: readonly StorefrontMember[]; total: number | undefined }>) {
  const mobileBound = rows.filter((member) => member.mobile_bound).length;
  const wechatBound = rows.filter((member) => member.wechat_bound).length;
  const active = rows.filter((member) => member.membership_status === 'active').length;
  return (
    <div className="storefrontmemberoverview" aria-label="当前会员概览">
      <OverviewItem icon="member" label="会员总数" value={total ?? '—'} />
      <OverviewItem icon="member" label="本页有效" value={active} />
      <OverviewItem icon="mobile" label="本页手机已绑定" value={mobileBound} tone="success" />
      <OverviewItem icon="wechat" label="本页微信已绑定" value={wechatBound} tone="purple" />
    </div>
  );
}

function OverviewItem({ icon, label, value, tone = 'blue' }: Readonly<{
  icon: MemberIconName;
  label: string;
  value: number | string;
  tone?: 'blue' | 'purple' | 'success';
}>) {
  return <article className="storefrontmemberoverviewitem" data-tone={tone}>
    <MemberIcon name={icon} />
    <div><span>{label}</span><strong>{value}</strong></div>
  </article>;
}

function MemberDirectory({ rows, selectedId, onSelect }: Readonly<{
  rows: readonly StorefrontMember[];
  selectedId: string | undefined;
  onSelect: (member: StorefrontMember) => void;
}>) {
  return (
    <div className="storefrontmemberdirectory" role="table" aria-label="商城会员名单">
      <div className="storefrontmemberlisthead" role="row">
        <span role="columnheader">会员</span>
        <span role="columnheader">手机状态</span>
        <span role="columnheader">微信状态</span>
        <span className="storefrontmemberidentitycol" role="columnheader">消费身份</span>
        <span className="storefrontmemberstatuscol" role="columnheader">当前状态</span>
        <span role="columnheader">入会时间</span>
      </div>
      <div role="rowgroup">
        {rows.map((member) => (
          <button
            className="storefrontmemberrow"
            data-selected={selectedId === member.membership_id}
            key={member.membership_id}
            type="button"
            role="row"
            aria-label={`查看会员 ${member.display_name}`}
            aria-expanded={selectedId === member.membership_id}
            onClick={() => onSelect(member)}
          >
            <span className="storefrontmemberperson" role="cell">
              <i>{member.display_name.slice(0, 1)}</i>
              <strong>{member.display_name}</strong>
              <small>{member.mobile_masked}</small>
            </span>
            <BindingState bound={member.mobile_bound} label="手机" />
            <BindingState bound={member.wechat_bound} label="微信" />
            <span className="storefrontmemberidentity storefrontmemberidentitycol" role="cell">消费者</span>
            <span className="storefrontmemberstatuscol" role="cell"><StatusState status={member.membership_status} /></span>
            <time role="cell" dateTime={member.joined_at ?? undefined}>{formatDate(member.joined_at)}</time>
          </button>
        ))}
      </div>
    </div>
  );
}

function MemberDetail({ member, mallName, open, onClose }: Readonly<{
  member: StorefrontMember | null;
  mallName: string;
  open: boolean;
  onClose: () => void;
}>) {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const detailRef = useRef<HTMLElement>(null);
  const memberId = member?.membership_id ?? '';
  const [tab, setTab] = useState<MemberDetailTab>('profile');
  const [inviteeCursors, setInviteeCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const [orderCursors, setOrderCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const inviteeCursor = inviteeCursors.at(-1);
  const orderCursor = orderCursors.at(-1);
  const detailQuery = useQuery({
    queryKey: storefrontMemberDetailKey(context, memberId),
    queryFn: ({ signal }) => readStorefrontMemberDetail(context, memberId, signal),
    enabled: open && memberId !== '',
  });
  const inviteesQuery = useQuery({
    queryKey: storefrontMemberInviteesKey(context, memberId, inviteeCursor),
    queryFn: ({ signal }) => readStorefrontMemberInvitees(context, memberId, inviteeCursor, signal),
    enabled: open && memberId !== '' && tab === 'referrals',
  });
  const ordersQuery = useQuery({
    queryKey: storefrontMemberOrdersKey(context, memberId, orderCursor),
    queryFn: ({ signal }) => readStorefrontMemberOrders(context, memberId, orderCursor, signal),
    enabled: open && memberId !== '' && tab === 'orders',
  });

  useEffect(() => {
    if (open) detailRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    setTab('profile');
    setInviteeCursors([undefined]);
    setOrderCursors([undefined]);
  }, [memberId]);

  const detail = detailQuery.data;
  const visibleMember = detail ?? member;
  const detailError = safeQueryError(detailQuery.error);
  return (
    <aside ref={detailRef} className="storefrontmemberdetail" aria-hidden={!open} aria-label="会员详情" tabIndex={-1}>
      <header className="storefrontmemberpanelheading">
        <div><h2>会员详情</h2><span data-tone="purple">消费者</span></div>
        <IconButton label="关闭会员详情" icon="close" onPress={onClose} tabIndex={open ? 0 : -1} />
      </header>
      {visibleMember === null ? null : <div className="storefrontmemberdetailbody">
        <section className="storefrontmemberidentitycard">
          <i>{visibleMember.display_name.slice(0, 1)}</i>
          <div>
            <h3>{visibleMember.display_name}</h3>
            <p>{visibleMember.mobile_masked}</p>
          </div>
          <StatusState status={visibleMember.membership_status} />
        </section>

        <div className="storefrontmembertags" aria-label="会员标签">
          <span>消费者</span>
          <span data-tone={visibleMember.membership_status === 'active' ? 'success' : 'muted'}>{membershipLabel(visibleMember.membership_status)}</span>
          {visibleMember.mobile_bound ? <span data-tone="success">手机已绑定</span> : null}
          {visibleMember.wechat_bound ? <span data-tone="purple">微信已绑定</span> : null}
        </div>

        <nav className="storefrontmemberdetailtabs" aria-label="会员档案">
          <DetailTab selected={tab === 'profile'} onPress={() => setTab('profile')}>个人资料</DetailTab>
          <DetailTab selected={tab === 'referrals'} onPress={() => setTab('referrals')}>邀请关系</DetailTab>
          <DetailTab selected={tab === 'orders'} onPress={() => setTab('orders')}>个人订单</DetailTab>
        </nav>

        {detail === undefined && detailError === undefined ? <DetailLoading /> : null}
        {detailError === undefined ? null : (
          <DetailError message={detailError} onRetry={() => void detailQuery.refetch()} />
        )}
        {detail === undefined ? null : <div className="storefrontmembertabcontent" key={tab}>
          {tab === 'profile' ? <ProfileTab detail={detail} mallName={mallName} /> : null}
          {tab === 'referrals' ? (
            <ReferralTab
              detail={detail}
              query={inviteesQuery}
              page={inviteeCursors.length}
              onPrevious={() => setInviteeCursors((current) => current.slice(0, -1))}
              onNext={(next) => setInviteeCursors((current) => [...current, next])}
            />
          ) : null}
          {tab === 'orders' ? (
            <OrdersTab
              detail={detail}
              query={ordersQuery}
              page={orderCursors.length}
              onOpen={(id) => void navigate(scopePath(context.scope, `orders/${encodeURIComponent(id)}`))}
              onPrevious={() => setOrderCursors((current) => current.slice(0, -1))}
              onNext={(next) => setOrderCursors((current) => [...current, next])}
            />
          ) : null}
        </div>}

        <p className="storefrontmembernotice">系统资料来自真实业务数据；自定义标签与资料由当前商城维护</p>
      </div>}
    </aside>
  );
}

function DetailTab({ selected, children, onPress }: Readonly<{
  selected: boolean;
  children: string;
  onPress: () => void;
}>) {
  return <button type="button" role="tab" aria-selected={selected} onClick={onPress}>{children}</button>;
}

function ProfileTab({ detail, mallName }: Readonly<{ detail: StorefrontMemberDetail; mallName: string }>) {
  return <>
    <section className="storefrontmemberdetailsection">
      <header><h3>系统资料</h3><span>只读</span></header>
      <dl className="storefrontmemberfacts">
        <Fact label="显示名称" value={detail.display_name} />
        <Fact label="脱敏手机号" value={detail.mobile_masked} />
        <Fact label="当前状态" value={membershipLabel(detail.membership_status)} tone={detail.membership_status === 'active' ? 'success' : 'muted'} />
        <Fact label="手机绑定" value={detail.mobile_bound ? '已绑定' : '未绑定'} tone={detail.mobile_bound ? 'success' : 'muted'} />
        <Fact label="微信绑定" value={detail.wechat_bound ? '已绑定' : '未绑定'} tone={detail.wechat_bound ? 'success' : 'muted'} />
        <Fact label="所属商城" value={mallName} />
        <Fact label="入会时间" value={formatDate(detail.joined_at)} />
      </dl>
    </section>
    <StorefrontMemberCustomProfile membershipId={detail.membership_id} />
  </>;
}

function ReferralTab({ detail, query, page, onPrevious, onNext }: Readonly<{
  detail: StorefrontMemberDetail;
  query: MemberPageQuery<StorefrontMemberInvitee>;
  page: number;
  onPrevious: () => void;
  onNext: (cursor: string) => void;
}>) {
  const error = safeQueryError(query.error);
  const inviter = detail.inviter;
  return <>
    <section className="storefrontmemberdetailsection">
      <header><h3>邀请人</h3><span>{inviter?.relationship_status === 'expired' ? '关系已过期' : inviter === null ? '暂无' : '关系有效'}</span></header>
      {inviter === null ? <div className="storefrontmemberemptyline">该会员暂无邀请人</div> : (
        <article className="storefrontmemberinviter">
          <i>{inviter.display_name.slice(0, 1)}</i>
          <div><strong>{inviter.display_name}</strong><span>{inviter.mobile_masked}</span></div>
          <time dateTime={inviter.bound_at}>绑定于 {formatDate(inviter.bound_at)}</time>
        </article>
      )}
    </section>
    <section className="storefrontmemberdetailsection">
      <header><h3>他邀请的会员</h3><strong>{detail.invited_count}</strong></header>
      <PagedResource query={query} label="被邀请会员">
        <InviteeList rows={query.data?.items ?? []} />
      </PagedResource>
      <DetailPagination
        page={page}
        fetching={query.isFetching}
        nextCursor={query.data?.nextCursor}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  </>;
}

function InviteeList({ rows }: Readonly<{ rows: readonly StorefrontMemberInvitee[] }>) {
  if (rows.length === 0) return <div className="storefrontmemberemptyline">暂未邀请其他会员</div>;
  return <div className="storefrontmemberrelationlist">
    {rows.map((invitee) => <article key={invitee.membership_id}>
      <i>{invitee.display_name.slice(0, 1)}</i>
      <div><strong>{invitee.display_name}</strong><span>{invitee.mobile_masked}</span></div>
      <time dateTime={invitee.bound_at}>{formatDate(invitee.bound_at)}</time>
      <span data-tone={invitee.relationship_status}>{invitee.relationship_status === 'active' ? '关系有效' : '关系已过期'}</span>
    </article>)}
  </div>;
}

function OrdersTab({ detail, query, page, onOpen, onPrevious, onNext }: Readonly<{
  detail: StorefrontMemberDetail;
  query: MemberPageQuery<StorefrontMemberOrder>;
  page: number;
  onOpen: (id: string) => void;
  onPrevious: () => void;
  onNext: (cursor: string) => void;
}>) {
  return <>
    <section className="storefrontmemberorderoverview">
      <div><span>订单数量</span><strong>{detail.order_count}</strong></div>
      <div><span>最近下单</span><strong>{detail.latest_order_at === null ? '暂无' : formatDate(detail.latest_order_at)}</strong></div>
    </section>
    <section className="storefrontmemberdetailsection">
      <header><h3>最近订单</h3><span>按下单时间排序</span></header>
      <PagedResource query={query} label="个人订单">
        <OrderList rows={query.data?.items ?? []} onOpen={onOpen} />
      </PagedResource>
      <DetailPagination
        page={page}
        fetching={query.isFetching}
        nextCursor={query.data?.nextCursor}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  </>;
}

function OrderList({ rows, onOpen }: Readonly<{
  rows: readonly StorefrontMemberOrder[];
  onOpen: (id: string) => void;
}>) {
  if (rows.length === 0) return <div className="storefrontmemberemptyline">该会员暂无订单</div>;
  return <div className="storefrontmemberorderlist">
    {rows.map((order) => <button key={order.id} type="button" onClick={() => onOpen(order.id)}>
      <div><strong>{order.order_number}</strong><time dateTime={order.created_at}>{formatDate(order.created_at)}</time></div>
      <b>{formatMoney(order.total_minor, order.currency)}</b>
      <span>{paymentLabel(order.payment_state)}</span>
      <span>{fulfillmentLabel(order.fulfillment_state)}</span>
      <span data-muted={order.aftersale_state === 'none'}>{aftersaleLabel(order.aftersale_state)}</span>
    </button>)}
  </div>;
}

function PagedResource({ query, label, children }: Readonly<{
  query: MemberPageQuery<unknown>;
  label: string;
  children: ReactNode;
}>) {
  const error = safeQueryError(query.error);
  if (query.data !== undefined && query.data.items.length === 0 && error === undefined) return children;
  return <ResourceState
    condition={resourceState(query.data, query.isFetching, error)}
    {...(error === undefined ? {} : { error })}
    retry={() => void query.refetch()}
    resourceLabel={label}
  >{children}</ResourceState>;
}

function DetailPagination({ page, fetching, nextCursor, onPrevious, onNext }: Readonly<{
  page: number;
  fetching: boolean;
  nextCursor: string | undefined;
  onPrevious: () => void;
  onNext: (cursor: string) => void;
}>) {
  if (page === 1 && nextCursor === undefined) return null;
  return <footer className="storefrontmemberdetailpagination">
    <button type="button" disabled={page === 1 || fetching} onClick={onPrevious}>上一页</button>
    <span>第 {page} 页</span>
    <button type="button" disabled={nextCursor === undefined || fetching} onClick={() => {
      if (nextCursor !== undefined) onNext(nextCursor);
    }}>下一页</button>
  </footer>;
}

function DetailLoading() {
  return <div className="storefrontmemberdetailloading" role="status">正在读取完整会员档案…</div>;
}

function DetailError({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return <div className="storefrontmemberdetailerror" role="alert">
    <p>{message}</p><button type="button" onClick={onRetry}>重新加载</button>
  </div>;
}

function formatMoney(minor: string, currency: string): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(Number(minor) / 100);
}

function Fact({ label, value, tone }: Readonly<{ label: string; value: string; tone?: 'muted' | 'success' }>) {
  return <div><dt>{label}</dt><dd data-tone={tone}>{tone !== undefined && <i />}{value}</dd></div>;
}

function BindingState({ bound, label }: Readonly<{ bound: boolean; label: string }>) {
  return <span className="storefrontmemberbinding" data-bound={bound} role="cell" aria-label={`${label}${bound ? '已绑定' : '未绑定'}`}>
    <i />{bound ? '已绑定' : '未绑定'}
  </span>;
}

function StatusState({ status }: Readonly<{ status: StorefrontMember['membership_status'] }>) {
  return <span className="storefrontmemberstatus" data-status={status}><i />{membershipLabel(status)}</span>;
}

function FilterButton({ active, children, onPress }: Readonly<{
  active: boolean;
  children: string;
  onPress: () => void;
}>) {
  return <button type="button" aria-pressed={active} onClick={onPress}>{children}</button>;
}

function IconButton({ label, icon, loading = false, onPress, tabIndex = 0 }: Readonly<{
  label: string;
  icon: MemberIconName;
  loading?: boolean;
  onPress: () => void;
  tabIndex?: number;
}>) {
  return <button
    className="storefrontmembericonbutton"
    data-loading={loading}
    type="button"
    aria-label={label}
    title={label}
    tabIndex={tabIndex}
    onClick={onPress}
  ><span><MemberIcon name={icon} /></span></button>;
}

const iconPaths: Readonly<Record<MemberIconName, readonly string[]>> = Object.freeze({
  close: ['M6 6l12 12', 'M18 6 6 18'],
  expand: ['M9 4H4v5', 'M15 4h5v5', 'M20 15v5h-5', 'M4 15v5h5'],
  member: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M4 22a8 8 0 0 1 16 0'],
  mobile: ['M7 2h10v20H7z', 'M10 18h4'],
  refresh: ['M20 11a8 8 0 1 0-2.34 5.66', 'M20 4v7h-7'],
  search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z', 'm17 17 4 4'],
  wechat: ['M10.5 17.5c-4.14 0-7.5-2.69-7.5-6s3.36-6 7.5-6 7.5 2.69 7.5 6-3.36 6-7.5 6Z', 'M8 11h.01', 'M13 11h.01', 'M17 10.5c2.76 0 5 1.79 5 4s-2.24 4-5 4c-.53 0-1.04-.07-1.52-.19L13 20l.7-2.33'],
});

function MemberIcon({ name }: Readonly<{ name: MemberIconName }>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {iconPaths[name].map((path) => <path key={path} d={path} />)}
  </svg>;
}

function membershipLabel(status: StorefrontMember['membership_status']): string {
  return ({ invited: '待入会', active: '有效', suspended: '已暂停', left: '已离开' } as const)[status];
}

function resourceState(data: unknown, fetching: boolean, error?: string): ResourceCondition {
  if (error !== undefined) return data === undefined ? 'failure' : 'stale';
  if (data === undefined) return 'loading';
  const page = data as Readonly<{ items: readonly unknown[] }>;
  if (page.items.length === 0) return 'empty';
  return fetching ? 'refreshing' : 'ready';
}
