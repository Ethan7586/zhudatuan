import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import { lazy, Suspense } from 'react';
import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import type { ReferralViewModel } from '../viewmodel/ReferralViewModel';
import { BindingTable } from './BindingTable';
import { ProductTable } from './ProductTable';
import { PromotionTable } from './PromotionTable';
import { ReviewTable } from './ReviewTable';
import { SettingsPanel } from './SettingsPanel';
import { WithdrawalTable } from './WithdrawalTable';
import './Referral.css';
import './ReferralResponsive.css';

const ActionDialog = lazy(() => import('./ReferralActionDialog').then((module) => ({ default: module.ReferralActionDialog })));

export function ReferralPage({ title, model }: Readonly<{ title: string; model: ReferralViewModel }>) {
  const error = model.error === undefined ? {} : { error: model.error };
  const retry = model.canRefresh ? { retry: model.actions.refresh } : {};
  return (
    <div className="referralworkspace">
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('分销返佣')}
        description={model.meta.description}
        condition={model.condition}
        {...error}
        {...retry}
        actions={
          <>
            <ReferralTabs model={model} />
            {model.canRefresh ? (
              <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
                {model.fetching ? '正在刷新…' : '刷新'}
              </Button>
            ) : null}
          </>
        }
        notice={
          model.receipt ? (
            <div className="referralreceipt">
              <ActionReceipt state={{ kind: 'success', receipt: model.receipt, objectLabel: '分销业务', impact: '当前设置、推广、绑定、审核或提现记录已按服务端结果更新。' }} dismiss={{ label: '关闭回执', onPress: model.actions.dismissReceipt }} />
            </div>
          ) : undefined
        }
      >
        <section className="referralboundary">
          <span aria-hidden="true">✓</span>
          <div>
            <h2>{model.meta.title}</h2>
            <p>{model.meta.boundary}</p>
          </div>
        </section>
        {model.content ? <ReferralContent model={model.content} /> : null}
        {model.page ? (
          <footer className="referralpagination">
            <span>本页 {model.page.count} 条</span>
            <div>
              {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
              {model.page.nextCursor ? <Button onPress={() => model.actions.next(model.page?.nextCursor ?? '')}>下一页</Button> : null}
            </div>
          </footer>
        ) : null}
      </ResourcePanel>
      {model.action ? (
        <Suspense fallback={<p role="status">正在打开操作表单…</p>}>
          <ActionDialog model={model.action} actions={model.actions} />
        </Suspense>
      ) : null}
    </div>
  );
}

function ReferralTabs({ model }: Readonly<{ model: ReferralViewModel }>) {
  return (
    <nav className="referraltabs" aria-label="分销返佣工作台">
      {model.navigation.items.map((item) => (
        <button key={item.key} type="button" aria-current={model.navigation.active === item.key ? 'page' : undefined} onClick={() => model.navigation.select(item.key)}>
          {item.title}
        </button>
      ))}
    </nav>
  );
}

function ReferralContent({ model }: Readonly<{ model: NonNullable<ReferralViewModel['content']> }>) {
  if (model.kind === 'settings') return <SettingsPanel model={model} />;
  if (model.kind === 'product') return <ProductTable model={model} />;
  if (model.kind === 'review') return <ReviewTable model={model} />;
  if (model.kind === 'binding') return <BindingTable model={model} />;
  if (model.kind === 'withdrawal') return <WithdrawalTable model={model} />;
  return <PromotionTable model={model} />;
}
