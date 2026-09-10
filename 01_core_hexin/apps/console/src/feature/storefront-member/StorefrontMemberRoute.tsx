import { Empty, ResourceState, type ResourceCondition } from '@shop/design';
import type { StorefrontMember } from '@shop/contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopeDisplayName } from '../../entity/session/ScopePresentation';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { readStorefrontMembers, storefrontMemberKey } from './StorefrontMemberQuery';
import './storefront-member.css';

type MemberFilter = 'all' | 'wechat-bound' | 'wechat-unbound';
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
          <em>只读名单</em>
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
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) detailRef.current?.focus({ preventScroll: true });
  }, [open]);
  return (
    <aside ref={detailRef} className="storefrontmemberdetail" aria-hidden={!open} aria-label="会员详情" tabIndex={-1}>
      <header className="storefrontmemberpanelheading">
        <div><h2>会员详情</h2><span data-tone="purple">消费者</span></div>
        <IconButton label="关闭会员详情" icon="close" onPress={onClose} tabIndex={open ? 0 : -1} />
      </header>
      {member === null ? null : <div className="storefrontmemberdetailbody">
        <section className="storefrontmemberidentitycard">
          <i>{member.display_name.slice(0, 1)}</i>
          <div>
            <h3>{member.display_name}</h3>
            <p>{member.mobile_masked}</p>
          </div>
          <StatusState status={member.membership_status} />
        </section>

        <dl className="storefrontmemberfacts">
          <Fact label="消费身份" value="消费者" />
          <Fact label="当前状态" value={membershipLabel(member.membership_status)} tone={member.membership_status === 'active' ? 'success' : 'muted'} />
          <Fact label="手机绑定" value={member.mobile_bound ? '已绑定' : '未绑定'} tone={member.mobile_bound ? 'success' : 'muted'} />
          <Fact label="微信绑定" value={member.wechat_bound ? '已绑定' : '未绑定'} tone={member.wechat_bound ? 'success' : 'muted'} />
          <Fact label="所属商城" value={mallName} />
          <Fact label="入会时间" value={formatDate(member.joined_at)} />
        </dl>

        <section className="storefrontmemberrecord">
          <h3>会员记录</h3>
          <div>
            <i />
            <time dateTime={member.joined_at ?? undefined}>{formatDate(member.joined_at)}</time>
            <p><strong>加入{mallName}</strong><span>成为商城会员</span></p>
          </div>
          <div data-muted={!member.mobile_bound}>
            <i />
            <span>{member.mobile_bound ? '已完成' : '暂无'}</span>
            <p><strong>手机绑定</strong><span>{member.mobile_bound ? member.mobile_masked : '尚未绑定手机'}</span></p>
          </div>
          <div data-muted={!member.wechat_bound}>
            <i />
            <span>{member.wechat_bound ? '已完成' : '暂无'}</span>
            <p><strong>微信绑定</strong><span>{member.wechat_bound ? '已绑定微信账号' : '尚未绑定微信'}</span></p>
          </div>
        </section>

        <p className="storefrontmembernotice">会员资料来自真实业务数据，本页面仅供查看</p>
      </div>}
    </aside>
  );
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
