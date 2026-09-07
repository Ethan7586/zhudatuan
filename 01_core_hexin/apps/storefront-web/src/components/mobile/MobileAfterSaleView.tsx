import React from 'react';
import { Camera, Check, ChevronLeft, Clock3, PackageOpen, RotateCcw, Truck, WalletCards } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';
import { storefrontImageUrl } from '../../services/storefrontImageUrl';

interface MobileAfterSaleViewProps {
  order: FrontendOrder;
  onBack: () => void;
  onSubmit: () => void;
}

type ServiceType = 'return_goods' | 'refund_only';
type ReturnMethod = 'pickup' | 'self_send';

const REASONS = ['商品与描述不符', '质量或破损问题', '错发/漏发', '不再需要'];

export function MobileAfterSaleView({ order, onBack, onSubmit }: Readonly<MobileAfterSaleViewProps>) {
  if (order.status === 'after_sale') return <AfterSaleProgress order={order} onBack={onBack} />;
  return <AfterSaleApplication order={order} onBack={onBack} onSubmit={onSubmit} />;
}

function AfterSaleApplication({ order, onBack, onSubmit }: Readonly<MobileAfterSaleViewProps>) {
  const [selectedIds, setSelectedIds] = React.useState(() => new Set(order.items.map((item) => item.productId)));
  const [serviceType, setServiceType] = React.useState<ServiceType>('return_goods');
  const [reason, setReason] = React.useState(REASONS[0]);
  const [returnMethod, setReturnMethod] = React.useState<ReturnMethod>('pickup');
  const [hasPhoto, setHasPhoto] = React.useState(false);
  const selectedAmount = order.items.reduce((sum, item) => selectedIds.has(item.productId) ? sum + item.priceAtPurchase * item.quantity : sum, 0);

  const toggleItem = (productId: string) => setSelectedIds((previous) => {
    const next = new Set(previous);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    return next;
  });

  return (
    <div className="min-h-full bg-[#F3F6FA] pb-24 text-gray-800">
      <PageHeader title="申请退货/退款" subtitle={`订单 ${order.orderNo}`} onBack={onBack} />
      <main className="space-y-3 p-3">
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-3.5 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center text-[9px]">
            {['选择商品', '说明原因', '提交申请'].map((step, index) => (
              <div key={step} className="space-y-1.5">
                <div className={`mx-auto grid h-6 w-6 place-items-center rounded-full font-black ${index === 0 ? 'bg-[var(--sw-brand)] text-white' : 'bg-white text-gray-400'}`}>{index + 1}</div>
                <span className={index === 0 ? 'font-bold text-blue-700' : 'text-gray-400'}>{step}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-xs font-black text-gray-950">选择售后商品</h2><span className="text-[9px] text-gray-400">已选 {selectedIds.size} 种</span></div>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => {
              const selected = selectedIds.has(item.productId);
              return (
                <button key={item.productId} type="button" onClick={() => toggleItem(item.productId)} className="flex w-full items-center gap-2.5 text-left">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-[var(--sw-brand)] bg-[var(--sw-brand)] text-white' : 'border-gray-300 bg-white text-transparent'}`}><Check className="h-3 w-3" /></span>
                  <img src={storefrontImageUrl(item.product.imageUrl, 112)} srcSet={`${storefrontImageUrl(item.product.imageUrl, 56)} 1x, ${storefrontImageUrl(item.product.imageUrl, 112)} 2x, ${storefrontImageUrl(item.product.imageUrl, 168)} 3x`} alt={item.productTitle} width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-xl bg-gray-50 object-cover" />
                  <span className="min-w-0 flex-1"><strong className="line-clamp-2 block text-[10px] leading-4 text-gray-800">{item.productTitle}</strong><span className="mt-1 block text-[9px] text-gray-400">¥{item.priceAtPurchase.toFixed(2)} × {item.quantity}</span></span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <h2 className="text-xs font-black text-gray-950">需要哪种服务</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ServiceTypeButton active={serviceType === 'return_goods'} icon={<PackageOpen className="h-5 w-5" />} title="退货退款" description="寄回商品后退款" onClick={() => setServiceType('return_goods')} />
            <ServiceTypeButton active={serviceType === 'refund_only'} icon={<WalletCards className="h-5 w-5" />} title="仅退款" description="无需寄回商品" onClick={() => setServiceType('refund_only')} />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <h2 className="text-xs font-black text-gray-950">申请原因</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {REASONS.map((item) => <button key={item} type="button" onClick={() => setReason(item)} className={`rounded-full px-3 py-2 text-[9px] font-semibold ${reason === item ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-gray-50 text-gray-500'}`}>{item}</button>)}
          </div>
          <button type="button" onClick={() => setHasPhoto(true)} className="mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-[#FAFBFC] text-[10px] text-gray-400">
            {hasPhoto ? <><Check className="h-4 w-4 text-emerald-500" /><span className="font-semibold text-emerald-600">已添加 1 张问题凭证</span></> : <><Camera className="h-4 w-4" /><span>添加照片或视频凭证（选填）</span></>}
          </button>
        </section>

        {serviceType === 'return_goods' && (
          <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <h2 className="text-xs font-black text-gray-950">退货方式</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ReturnMethodButton active={returnMethod === 'pickup'} icon={<Truck className="h-4 w-4" />} title="上门取件" description="推荐，无需垫付" onClick={() => setReturnMethod('pickup')} />
              <ReturnMethodButton active={returnMethod === 'self_send'} icon={<RotateCcw className="h-4 w-4" />} title="自行寄回" description="填写物流单号" onClick={() => setReturnMethod('self_send')} />
            </div>
          </section>
        )}
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-100 bg-white/96 px-3 py-2.5 backdrop-blur">
        <div><p className="text-[9px] text-gray-400">预计退款</p><p className="text-lg font-black text-[#E5484D]">¥{selectedAmount.toFixed(2)}</p></div>
        <button type="button" disabled={selectedIds.size === 0} onClick={onSubmit} className="min-h-11 rounded-full bg-[var(--sw-brand)] px-7 text-xs font-black text-white shadow-[0_8px_20px_rgba(36,105,232,0.24)] disabled:bg-gray-300 disabled:shadow-none">提交申请</button>
      </footer>
    </div>
  );
}

function AfterSaleProgress({ order, onBack }: Readonly<Pick<MobileAfterSaleViewProps, 'order' | 'onBack'>>) {
  return (
    <div className="min-h-full bg-[#F3F6FA] pb-6 text-gray-800">
      <PageHeader title="售后进度" subtitle={`售后单 AS-${order.orderNo.slice(-8)}`} onBack={onBack} />
      <main className="space-y-3 p-3">
        <section className="rounded-3xl bg-gradient-to-br from-[#6855D9] to-[#8A74EF] p-4 text-white shadow-[0_14px_32px_rgba(104,85,217,0.2)]">
          <p className="text-[10px] text-purple-100">当前状态</p><h2 className="mt-1 text-xl font-black">审核处理中</h2><p className="mt-1 text-[10px] text-purple-100">预计 1 个工作日内完成审核</p>
        </section>
        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-black text-gray-950">处理进度</h3>
          <div className="mt-4 space-y-0">
            <ProgressLine active title="申请已提交" detail="系统已收到退货退款申请" />
            <ProgressLine active title="商户审核中" detail="正在核对订单与商品信息" />
            <ProgressLine title="退货取件" detail="审核通过后安排上门取件" />
            <ProgressLine title="退款到账" detail="验收完成后原路退回" last />
          </div>
        </section>
        <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-3"><img src={storefrontImageUrl(order.items[0]?.product.imageUrl ?? '', 112)} srcSet={`${storefrontImageUrl(order.items[0]?.product.imageUrl ?? '', 56)} 1x, ${storefrontImageUrl(order.items[0]?.product.imageUrl ?? '', 112)} 2x, ${storefrontImageUrl(order.items[0]?.product.imageUrl ?? '', 168)} 3x`} alt="售后商品" width={56} height={56} loading="eager" fetchPriority="high" decoding="async" className="h-14 w-14 rounded-xl bg-gray-50 object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-[10px] font-bold leading-4">{order.items[0]?.productTitle}</p><p className="mt-1 text-[9px] text-gray-400">退款金额 ¥{order.totalAmount.toFixed(2)}</p></div></div>
        </section>
      </main>
    </div>
  );
}

function PageHeader({ title, subtitle, onBack }: Readonly<{ title: string; subtitle: string; onBack: () => void }>) {
  return <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-3 py-3 backdrop-blur"><button type="button" onClick={onBack} className="rounded-full p-1.5 active:bg-gray-100" aria-label="返回"><ChevronLeft className="h-5 w-5" /></button><div><h1 className="text-sm font-black text-gray-950">{title}</h1><p className="mt-0.5 font-mono text-[9px] text-gray-400">{subtitle}</p></div></header>;
}

function ServiceTypeButton({ active, icon, title, description, onClick }: Readonly<{ active: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }>) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-3 text-left ${active ? 'border-blue-200 bg-blue-50/70 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}><span className="mb-2 block">{icon}</span><strong className="block text-[11px]">{title}</strong><span className="mt-0.5 block text-[8px] opacity-70">{description}</span></button>;
}

function ReturnMethodButton({ active, icon, title, description, onClick }: Readonly<{ active: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }>) {
  return <button type="button" onClick={onClick} className={`flex items-start gap-2 rounded-2xl border p-2.5 text-left ${active ? 'border-blue-200 bg-blue-50/70 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}><span className="mt-0.5">{icon}</span><span><strong className="block text-[10px]">{title}</strong><span className="mt-0.5 block text-[8px] opacity-70">{description}</span></span></button>;
}

function ProgressLine({ active = false, title, detail, last = false }: Readonly<{ active?: boolean; title: string; detail: string; last?: boolean }>) {
  return <div className="flex gap-3"><div className="flex flex-col items-center"><span className={`grid h-5 w-5 place-items-center rounded-full ${active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-300'}`}>{active ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}</span>{!last && <span className={`h-9 w-px ${active ? 'bg-purple-200' : 'bg-gray-100'}`} />}</div><div><p className={`text-[10px] font-bold ${active ? 'text-gray-900' : 'text-gray-400'}`}>{title}</p><p className="mt-0.5 text-[8px] text-gray-400">{detail}</p></div></div>;
}
