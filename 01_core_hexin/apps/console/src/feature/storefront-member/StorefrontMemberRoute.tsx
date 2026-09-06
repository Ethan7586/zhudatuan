import { Badge, Button, Empty, ResourceState, Surface, WorkspaceHero, type ResourceCondition } from '@shop/design';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { StorefrontMember } from '@shop/contract';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopeDisplayName } from '../../entity/session/ScopePresentation';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { pageCursor } from '../../shared/url/PageCursor';
import { readStorefrontMembers, storefrontMemberKey } from './StorefrontMemberQuery';
import './storefront-member.css';

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const q = search.get('q')?.trim().slice(0, 100) ?? '';
  const cursor = search.get('cursor') ?? undefined;
  const [draft, setDraft] = useState(q);
  const request = { ...(q === '' ? {} : { q }), ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({
    queryKey: storefrontMemberKey(context, request),
    queryFn: ({ signal }) => readStorefrontMembers(context, request, signal),
    placeholderData: keepPreviousData,
  });
  const error = safeQueryError(query.error);
  const condition = resourceState(query.data, query.isFetching, error);
  const title = `${scopeDisplayName(context.scope)} · 商城会员`;

  useEffect(() => setDraft(q), [q]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(search);
    const normalized = draft.trim().slice(0, 100);
    if (normalized === '') next.delete('q');
    else next.set('q', normalized);
    next.delete('cursor');
    setSearch(next);
  };

  return (
    <div className="storefrontmembersworkspace">
      <WorkspaceHero
        eyebrow="L6 · STOREFRONT MEMBERSHIP"
        title={title}
        description="只读展示当前商城范围内的消费者 Membership，与后台权限数据分舱。"
        actions={<Button isPending={query.isFetching} onPress={() => void query.refetch()}>{query.isFetching ? '刷新中…' : '刷新'}</Button>}
        meta={<Badge tone="info">只读名单</Badge>}
      />

      <Surface className="storefrontmemberpanel" depth="low" padding="none" role="region" aria-labelledby="storefrontmemberlisttitle">
        <header className="storefrontmembertoolbar">
          <div>
            <h2 id="storefrontmemberlisttitle">商城会员名单</h2>
            <p>以 Membership ID 为行，不按手机号或自然人合并。</p>
          </div>
          <form role="search" onSubmit={submitSearch}>
            <label htmlFor="storefrontmembersearch">搜索商城会员</label>
            <input
              id="storefrontmembersearch"
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="显示名、手机号后四位或 Membership ID"
            />
            <Button size="compact" type="submit">搜索</Button>
          </form>
        </header>

        {query.data !== undefined && query.data.items.length === 0 && q !== '' && error === undefined ? (
          <Empty title="未找到匹配会员" description="请检查显示名、脱敏手机号后四位或 Membership ID。" />
        ) : (
          <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={() => void query.refetch()} resourceLabel="商城会员名单">
            <MemberTable rows={query.data?.items ?? []} />
          </ResourceState>
        )}

        <footer className="storefrontmemberpagination">
          <span>本页 {query.data?.count ?? 0} 条 · 游标分页</span>
          <Button
            size="compact"
            isDisabled={query.data?.nextCursor === undefined || query.isFetching}
            onPress={() => {
              if (query.data?.nextCursor !== undefined) setSearch(pageCursor(search, query.data.nextCursor));
            }}
          >
            {query.isFetching ? '加载中…' : '下一页'}
          </Button>
        </footer>
      </Surface>
    </div>
  );
}

function MemberTable({ rows }: Readonly<{ rows: readonly StorefrontMember[] }>) {
  return (
    <div className="storefrontmembertablewrap">
      <table aria-label="商城会员名单">
        <thead><tr>
          <th scope="col">会员</th><th scope="col">脱敏手机号</th><th scope="col">消费身份</th>
          <th scope="col">Membership 状态</th><th scope="col">手机绑定</th><th scope="col">微信绑定</th>
          <th scope="col">入会时间</th><th scope="col">Membership ID</th>
        </tr></thead>
        <tbody>{rows.map((member) => <tr key={member.membership_id}>
          <td data-label="会员"><strong>{member.display_name}</strong></td>
          <td data-label="脱敏手机号"><span className="storefrontmembermono">{member.mobile_masked}</span></td>
          <td data-label="消费身份"><Badge tone="info">{member.identity_level} · {identityLabel(member.identity_kind)}</Badge></td>
          <td data-label="Membership 状态"><Badge tone={membershipTone(member.membership_status)}>{membershipLabel(member.membership_status)}</Badge></td>
          <td data-label="手机绑定"><BindingBadge bound={member.mobile_bound} /></td>
          <td data-label="微信绑定"><BindingBadge bound={member.wechat_bound} /></td>
          <td data-label="入会时间">{formatDate(member.joined_at)}</td>
          <td data-label="Membership ID"><code>{member.membership_id}</code></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function BindingBadge({ bound }: Readonly<{ bound: boolean }>) {
  return <Badge tone={bound ? 'success' : 'neutral'}>{bound ? '已绑定' : '未绑定'}</Badge>;
}

function identityLabel(identity: StorefrontMember['identity_kind']): string {
  return identity === 'consumer' ? '消费身份' : identity;
}

function membershipLabel(status: StorefrontMember['membership_status']): string {
  return ({ invited: '待入会', active: '有效', suspended: '已暂停', left: '已离开' } as const)[status];
}

function membershipTone(status: StorefrontMember['membership_status']): 'neutral' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'invited' || status === 'suspended') return 'warning';
  return 'neutral';
}

function resourceState(data: unknown, fetching: boolean, error?: string): ResourceCondition {
  if (error !== undefined) return data === undefined ? 'failure' : 'stale';
  if (data === undefined) return 'loading';
  const page = data as Readonly<{ items: readonly unknown[] }>;
  if (page.items.length === 0) return 'empty';
  return fetching ? 'refreshing' : 'ready';
}
