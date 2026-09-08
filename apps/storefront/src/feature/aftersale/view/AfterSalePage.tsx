import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import type { useAfterSaleViewModel } from '../viewmodel/AfterSaleViewModel';
import { AfterSaleForm } from './AfterSaleForm';
import { AfterSaleHistory } from './AfterSaleHistory';

export function AfterSalePage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useAfterSaleViewModel> }>) {
  const { orderId, state, page, error, actions } = viewmodel;
  return (
    <section className="sw-web-container mx-auto max-w-[1240px] px-3 py-4 text-xs">
      <button type="button" onClick={actions.back} className="mb-3 flex min-h-11 items-center gap-1 font-bold text-[var(--sw-brand)]">
        <ArrowLeft size={15} />
        返回订单
      </button>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-3 rounded-xl border border-edge bg-surface p-4 shadow-sm">
          <div>
            <h1 className="text-lg font-black text-content">申请售后</h1>
            <p className="mt-1 text-muted">{chineseReference('内部订单', orderId)} · 数量、时间窗与退款金额由服务端实时判定</p>
          </div>
          {state === 'loading' ? <Status icon={RefreshCw} text="正在读取可售后商品…" /> : null}
          {error ? (
            <div role="alert" className="flex items-center rounded-lg bg-danger-surface p-3 font-bold text-danger-strong">
              {error}
              {state === 'failed' ? (
                <button type="button" onClick={actions.refresh} className="ml-auto underline">
                  重试
                </button>
              ) : null}
            </div>
          ) : null}
          {page && page.availableLines.length === 0 ? <Status icon={ShieldAlert} text="此订单当前没有可申请售后的商品" /> : null}
          {page && page.availableLines.length > 0 ? <AfterSaleForm viewmodel={viewmodel} /> : null}
        </div>
        <AfterSaleHistory page={page} />
      </div>
    </section>
  );
}

function Status({ icon: Icon, text }: Readonly<{ icon: typeof RefreshCw; text: string }>) {
  return (
    <div role="status" className="grid min-h-28 place-items-center rounded-lg bg-subtle text-muted">
      <Icon size={22} />
      <span>{text}</span>
    </div>
  );
}
