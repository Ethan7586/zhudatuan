import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { scopePath } from '../../shared/url/ScopePath';
import { pageCursor } from '../../shared/url/PageCursor';
import { decideReferralMember, type ReferralMemberDecisionKind } from './ReferralCommand';
import { readReferral, referralKey, referralOperation } from './ReferralQuery';
import { referralViews, type ReferralRecord, type ReferralView } from './ReferralSchema';
import './referral.css';

interface ReferralViewMeta {
  readonly title: string;
  readonly tab: string;
  readonly description: string;
  readonly boundaryTitle: string;
  readonly boundary: string;
}

const viewMeta: Readonly<Record<ReferralView, ReferralViewMeta>> = Object.freeze({
  settings: {
    title: '分销设定',
    tab: '分销设定',
    description: '查看当前商城的招募、绑定、结算和提现策略版本。',
    boundaryTitle: '金额策略只读',
    boundary: '修改返佣比例和提现策略属于 critical 操作，必须完成阶跃认证和 action proof 后才会开放。',
  },
  products: {
    title: '分销商品',
    tab: '分销商品',
    description: '查看当前商城已配置的导购商品、佣金比例与客户奖励比例。',
    boundaryTitle: '比例快照受保护',
    boundary: '订单计佣使用下单时的商品策略版本；后续修改不会回写历史佣金。',
  },
  review: {
    title: '分销审核',
    tab: '分销审核',
    description: '仅展示当前商城等待运营审核的会员申请。',
    boundaryTitle: '审核与改钱分权',
    boundary: '审核申请属于运营权限；返佣比例和提现政策仍由财务权限管理。',
  },
  bindings: {
    title: '分销关系',
    tab: '分销关系',
    description: '查看客户与导购会员的一层绑定关系和有效期。',
    boundaryTitle: '首次触点保留',
    boundary: '有效绑定不会被后续分享链接覆盖；系统只保留一层邀请人，不向上追溯第三层。',
  },
  withdrawals: {
    title: '佣金提现',
    tab: '佣金提现',
    description: '只读取已结算佣金的服务端可提现余额；申请审批与付款终态由财务提现流程承接。',
    boundaryTitle: '可提现只计算 settled',
    boundary: 'pending、settling 和 reversed 均不进入可提现金额；已被提现申请占用的 claim 也会扣除。',
  },
  promotion: {
    title: '推广详情',
    tab: '推广详情',
    description: '按订单行查看导购佣金、客户奖励、冲正和结算终态。',
    boundaryTitle: '账务记录不可删除',
    boundary: '退款通过 reversal 冲正并保留原始佣金；这里展示服务端终态，不把 reversed 混入收益。',
  },
});

const stateLabels: Readonly<Record<string, string>> = Object.freeze({
  active: '生效',
  inactive: '停用',
  unconfigured: '未配置',
  pending: '待处理',
  disqualified: '已取消资格',
  expired: '已过期',
  settling: '结算中',
  settled: '已结算',
  reversed: '已冲正',
  published: '已上架',
});

export function Component() {
  const context = useConsoleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const view = viewFromPath(location.pathname);
  const cursor = search.get('cursor') ?? undefined;
  const operation = referralOperation(view);
  const mallScope = context.scope.kind === 'mall';
  const capable = context.session.capabilities.includes(operation);
  const permitted = context.session.permissions.includes(operation);
  const readable = mallScope && capable && permitted;
  const query = useQuery({
    queryKey: referralKey(context, view, cursor),
    queryFn: ({ signal }) => readReferral(context, view, cursor, signal),
    enabled: readable,
    staleTime: 60_000,
  });
  const decision = useMutation({
    mutationFn: (input: Readonly<{ kind: ReferralMemberDecisionKind; memberId: string; version: number }>) => decideReferralMember(context, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: referralKey(context, 'review', cursor), exact: true });
    },
  });
  const data = query.data;
  const error = safeQueryError(query.error);
  const condition =
    !mallScope || !capable || !permitted
      ? 'denied'
      : queryCondition({
          pending: query.isPending,
          fetching: query.isFetching,
          error: query.error,
          hasData: data !== undefined,
          empty: data?.items.length === 0,
          stale: query.isStale,
        });
  const denied = !mallScope
    ? '分销返佣仅在商城范围可用，请先切换到具体商城。'
    : !capable
      ? `当前会话缺少 ${operation} 能力。`
      : !permitted
        ? `当前会话缺少 ${operation} 权限。`
        : undefined;
  const resourceError = denied ?? error;
  const meta = viewMeta[view];
  const csrfReady = context.session.csrf !== undefined;
  const canApprove = mallScope && csrfReady && context.session.permissions.includes('referral.members.approve') && context.session.capabilities.includes('referral.members.approve');
  const canDisqualify = mallScope && csrfReady && context.session.permissions.includes('referral.members.disqualify') && context.session.capabilities.includes('referral.members.disqualify');
  const columns =
    view === 'review'
      ? reviewColumnsWithActions({
          canApprove,
          canDisqualify,
          pending: decision.isPending,
          pendingKind: decision.variables?.kind,
          pendingMemberId: decision.variables?.memberId,
          decide: (kind, row) => decision.mutate({ kind, memberId: row.id, version: row.version }),
        })
      : columnsByView[view];
  const decisionError = safeQueryError(decision.error);
  const withdrawable = data?.items.reduce((total, row) => total + (row.withdrawableMinor ?? 0), 0) ?? 0;
  const boundary = view === 'withdrawals' ? { title: meta.boundaryTitle, message: `${meta.boundary} 当前页可提现合计 ${formatMinor(withdrawable)}。` } : { title: meta.boundaryTitle, message: meta.boundary };

  return (
    <div className="referralworkspace" data-view={view}>
      <PagedResource
        title={meta.title}
        eyebrow="REFERRAL OPERATIONS"
        description={meta.description}
        condition={condition}
        {...(resourceError === undefined ? {} : { error: resourceError })}
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        count={data?.count ?? 0}
        {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
        actions={
          <ReferralTabs
            view={view}
            onSelect={(next) => {
              decision.reset();
              void navigate(scopePath(context.scope, `referral/${next}`));
            }}
          />
        }
        boundary={boundary}
        retry={() => {
          if (readable) void query.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
      {view === 'review' && decision.isError ? (
        <section className="referralactionmessage iserror" role="alert">
          <strong>审核操作失败</strong>
          <span>{decisionError ?? 'REFERRAL_REVIEW_FAILED'}</span>
        </section>
      ) : null}
      {view === 'review' && decision.isSuccess ? (
        <p className="referralactionmessage issuccess" role="status">
          审核状态已更新，列表已重读。
        </p>
      ) : null}
    </div>
  );
}

function ReferralTabs({ view, onSelect }: Readonly<{ view: ReferralView; onSelect: (view: ReferralView) => void }>) {
  return (
    <nav className="referraltabs" aria-label="分销返佣工作台">
      {referralViews.map((candidate) => (
        <button key={candidate} type="button" aria-current={candidate === view ? 'page' : undefined} onClick={() => onSelect(candidate)}>
          {viewMeta[candidate].tab}
        </button>
      ))}
    </nav>
  );
}

function viewFromPath(pathname: string): ReferralView {
  const candidate = pathname.split('/').filter(Boolean).at(-1);
  return referralViews.includes(candidate as ReferralView) ? (candidate as ReferralView) : 'settings';
}

function state(value: string) {
  return (
    <span className="referralstate" data-state={value}>
      {stateLabels[value] ?? value}
    </span>
  );
}

const settingsColumns: readonly DataColumn<ReferralRecord>[] = Object.freeze([
  { key: 'setting', label: '运行状态', render: (row) => row.primary },
  { key: 'recruit', label: '招募', render: (row) => row.secondary },
  { key: 'state', label: '服务端状态', render: (row) => state(row.state) },
  { key: 'policy', label: '绑定 / 结算 / 次数', render: (row) => row.detail },
  { key: 'review', label: '审核 / 奖励', render: (row) => row.rate },
  { key: 'minimum', label: '最低提现', render: (row) => (row.amountMinor === null ? '—' : formatMinor(row.amountMinor, row.currency)) },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '策略版本', render: (row) => row.version },
]);

const productColumns: readonly DataColumn<ReferralRecord>[] = Object.freeze([
  { key: 'product', label: '商品', render: (row) => row.primary },
  { key: 'sku', label: 'SKU', render: (row) => row.secondary },
  { key: 'state', label: '状态', render: (row) => state(row.state) },
  { key: 'rate', label: '返佣比例', render: (row) => row.rate },
  { key: 'reference', label: '商品 / 上架引用', render: (row) => row.detail },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '版本', render: (row) => row.version },
]);

const reviewColumns: readonly DataColumn<ReferralRecord>[] = Object.freeze([
  { key: 'member', label: '申请人', render: (row) => row.primary },
  { key: 'memberid', label: '会员编号', render: (row) => row.secondary },
  { key: 'state', label: '状态', render: (row) => state(row.state) },
  { key: 'inviter', label: '邀请关系', render: (row) => row.detail },
  { key: 'review', label: '审核', render: (row) => row.rate },
  { key: 'created', label: '申请时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '版本', render: (row) => row.version },
]);

interface ReviewColumnOptions {
  readonly canApprove: boolean;
  readonly canDisqualify: boolean;
  readonly pending: boolean;
  readonly pendingKind: ReferralMemberDecisionKind | undefined;
  readonly pendingMemberId: string | undefined;
  readonly decide: (kind: ReferralMemberDecisionKind, row: ReferralRecord) => void;
}

function reviewColumnsWithActions(options: ReviewColumnOptions): readonly DataColumn<ReferralRecord>[] {
  return [
    ...reviewColumns,
    {
      key: 'actions',
      label: '操作',
      render: (row) => {
        const targetPending = options.pending && options.pendingMemberId === row.id;
        return (
          <div className="referralreviewactions">
            <button type="button" disabled={options.pending || !options.canApprove} title={options.canApprove ? undefined : '缺少通过权限、能力或 CSRF 会话'} onClick={() => options.decide('approve', row)}>
              {targetPending && options.pendingKind === 'approve' ? `正在通过 ${row.primary}…` : `通过 ${row.primary}`}
            </button>
            <button type="button" disabled={options.pending || !options.canDisqualify} title={options.canDisqualify ? undefined : '缺少取消资格权限、能力或 CSRF 会话'} onClick={() => options.decide('disqualify', row)}>
              {targetPending && options.pendingKind === 'disqualify' ? `正在取消 ${row.primary}…` : `取消资格 ${row.primary}`}
            </button>
          </div>
        );
      },
    },
  ];
}

const bindingColumns: readonly DataColumn<ReferralRecord>[] = Object.freeze([
  { key: 'customer', label: '客户', render: (row) => row.primary },
  { key: 'relationship', label: '客户 → 导购', render: (row) => row.secondary },
  { key: 'state', label: '状态', render: (row) => state(row.state) },
  { key: 'referral', label: '绑定详情', render: (row) => row.detail },
  { key: 'rule', label: '归因规则', render: (row) => row.rate },
  { key: 'bound', label: '绑定时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '版本', render: (row) => row.version },
]);

const withdrawalColumns: readonly DataColumn<ReferralRecord>[] = Object.freeze([
  { key: 'member', label: '受益会员', render: (row) => row.primary },
  { key: 'order', label: '订单 / 行', render: (row) => row.secondary },
  { key: 'state', label: '状态', render: (row) => state(row.state) },
  { key: 'kind', label: '佣金类型 / 比例', render: (row) => row.rate },
  { key: 'net', label: '结算净额', render: (row) => (row.amountMinor === null ? '—' : formatMinor(row.amountMinor, row.currency)) },
  { key: 'withdrawable', label: '可提现', render: (row) => (row.withdrawableMinor === null ? '—' : formatMinor(row.withdrawableMinor, row.currency)) },
  { key: 'settled', label: '结算时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '版本', render: (row) => row.version },
]);

const promotionColumns: readonly DataColumn<ReferralRecord>[] = Object.freeze([
  { key: 'member', label: '受益会员', render: (row) => row.primary },
  { key: 'order', label: '订单 / 行', render: (row) => row.secondary },
  { key: 'state', label: '账务状态', render: (row) => state(row.state) },
  { key: 'kind', label: '类型 / 比例', render: (row) => row.rate },
  { key: 'net', label: '净佣金', render: (row) => (row.amountMinor === null ? '—' : formatMinor(row.amountMinor, row.currency)) },
  { key: 'detail', label: 'SKU / 计佣 / 冲正 / 占用 / 追回', render: (row) => row.detail },
  { key: 'occurred', label: '业务时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '版本', render: (row) => row.version },
]);

const columnsByView: Readonly<Record<ReferralView, readonly DataColumn<ReferralRecord>[]>> = Object.freeze({
  settings: settingsColumns,
  products: productColumns,
  review: reviewColumns,
  bindings: bindingColumns,
  withdrawals: withdrawalColumns,
  promotion: promotionColumns,
});
