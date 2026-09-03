import { chineseSectionLabel, queryCondition, safeQueryError } from '@shop/presentation';
import { Button, ResourcePanel } from '@shop/design';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import { useRouteTitle } from '../../shared/ui/RouteTitle';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { BindingTable } from './BindingTable';
import { CommissionTable } from './CommissionTable';
import { MemberTable } from './MemberTable';
import { ProductTable } from './ProductTable';
import { decideReferralAccess } from './ReferralAccess';
import { executeReferralAction, type ReferralActionInput } from './ReferralCommand';
import { readReferral, referralKey, referralOperation, referralPermission } from './ReferralQuery';
import { referralViews, type ReferralAction, type ReferralPage, type ReferralView } from './ReferralSchema';
import { SettingsPanel } from './SettingsPanel';
import { WithdrawalTable } from './WithdrawalTable';
import './Referral.css';

const ReferralActionDialog = lazy(() => import('./ReferralActionDialog').then((module) => ({ default: module.ReferralActionDialog })));

const meta: Readonly<Record<ReferralView, Readonly<{ title: string; description: string; boundary: string }>>> = Object.freeze({
  settings: { title: '分销设定', description: '管理首次归因、默认返佣与最低提现策略。', boundary: '修改策略需完成高强度二次验证，由另一位复核人签发一次性复核凭证，并校验当前版本和审计原因。' },
  products: { title: '分销商品', description: '查看商品返佣启停状态与比例版本。', boundary: '商品比例按订单快照固化；修改不会回写历史佣金。' },
  members: { title: '分销审核', description: '审核推广会员申请并管理推广资格。', boundary: '申请人、操作人和复核人分离；版本冲突时必须重读后再决定。' },
  bindings: { title: '分销关系', description: '查看客户与推广会员的一层首次有效绑定。', boundary: '有效绑定不能被后续链接覆盖，Token 只保存不可逆指纹。' },
  commissions: { title: '推广详情', description: '按订单查看佣金、可结算时间和冲正终态。', boundary: '退款仅追加反向 Movement，原始佣金和财务分录不可删除。' },
  withdrawals: { title: '佣金提现', description: '查看本人提现申请、处理结果和版本。', boundary: '提现只使用可用余额；申请、冲正和付款通过确定性业务键防重。' },
});

export function Component() {
  const context = useConsoleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const view = readView(location.pathname);
  const cursor = search.get('cursor') ?? undefined;
  const operation = referralOperation(view);
  const decision = decideReferralAccess(context, referralPermission(view), operation);
  const allowed = decision.allowed;
  const query = useQuery({ queryKey: referralKey(context, view, cursor), queryFn: ({ signal }) => readReferral(context, view, cursor, signal), enabled: allowed });
  const [action, setAction] = useState<ReferralAction>();
  const mutation = useMutation({
    mutationFn: (input: ReferralActionInput) => executeReferralAction(context, input),
    onSuccess: async () => {
      setAction(undefined);
      await queryClient.invalidateQueries({ queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion] });
    },
  });
  const data = query.data;
  const resourceError = allowed ? safeQueryError(query.error) : decision.reason;
  const condition = allowed ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 }) : 'denied';
  const viewMeta = meta[view];
  const title = useRouteTitle('分销返佣');
  const canManageSetting = decideReferralAccess(context, 'referral.setting.manage', 'referral.settings.manage').allowed;
  const canManageProduct = decideReferralAccess(context, 'referral.product.manage', 'referral.products.manage').allowed;
  const canDecideMember = decideReferralAccess(context, 'referral.member.decide', 'referral.members.approve').allowed || decideReferralAccess(context, 'referral.member.decide', 'referral.members.disqualify').allowed;
  return (
    <div className="referralworkspace">
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('分销返佣')}
        description={viewMeta.description}
        condition={condition}
        {...(resourceError === undefined ? {} : { error: resourceError })}
        retry={() => void query.refetch()}
        actions={
          <>
            <ReferralTabs view={view} onSelect={(next) => void navigate(scopePath(context.scope, `referral/${next}`))} />
            <Button onPress={() => void query.refetch()}>刷新</Button>
          </>
        }
      >
        <section className="referralboundary">
          <h2>{viewMeta.title}</h2>
          <p>{viewMeta.boundary}</p>
        </section>
        {data === undefined ? null : <ReferralContent page={data} canManageSetting={canManageSetting} canManageProduct={canManageProduct} canDecideMember={canDecideMember} onAction={setAction} />}
        {data === undefined ? null : (
          <footer className="referralpagination">
            <span>本页 {data.count} 条</span>
            <Button onPress={() => data.nextCursor && setSearch(pageCursor(search, data.nextCursor))} isDisabled={data.nextCursor === undefined}>
              下一页
            </Button>
          </footer>
        )}
      </ResourcePanel>
      {action === undefined ? null : (
        <Suspense fallback={<p role="status">正在打开操作表单…</p>}>
          <ReferralActionDialog
            action={action}
            busy={mutation.isPending}
            assurance={context.session.assurance.level}
            makerMembership={context.session.membership}
            error={safeQueryError(mutation.error)}
            onClose={() => !mutation.isPending && setAction(undefined)}
            onSubmit={(input) => mutation.mutate(input)}
          />
        </Suspense>
      )}
      {mutation.isSuccess ? (
        <p className="referralnotice issuccess" role="status">
          操作已提交并完成权威回读。
        </p>
      ) : null}
    </div>
  );
}

function ReferralContent({
  page,
  canManageSetting,
  canManageProduct,
  canDecideMember,
  onAction,
}: Readonly<{ page: ReferralPage; canManageSetting: boolean; canManageProduct: boolean; canDecideMember: boolean; onAction: (action: ReferralAction) => void }>) {
  if (page.view === 'settings') return <SettingsPanel rows={page.items} canManage={canManageSetting} onManage={onAction} />;
  if (page.view === 'products') return <ProductTable rows={page.items} canManage={canManageProduct} onManage={onAction} />;
  if (page.view === 'members') return <MemberTable rows={page.items} canDecide={canDecideMember} onDecide={onAction} />;
  if (page.view === 'bindings') return <BindingTable rows={page.items} />;
  if (page.view === 'commissions') return <CommissionTable rows={page.items} />;
  return <WithdrawalTable rows={page.items} />;
}

function ReferralTabs({ view, onSelect }: Readonly<{ view: ReferralView; onSelect: (view: ReferralView) => void }>) {
  return (
    <nav className="referraltabs" aria-label="分销返佣工作台">
      {referralViews.map((candidate) => (
        <button key={candidate} type="button" aria-current={view === candidate ? 'page' : undefined} onClick={() => onSelect(candidate)}>
          {meta[candidate].title}
        </button>
      ))}
    </nav>
  );
}

function readView(pathname: string): ReferralView {
  const value = pathname.split('/').filter(Boolean).at(-1);
  return referralViews.includes(value as ReferralView) ? (value as ReferralView) : 'settings';
}
