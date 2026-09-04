import React from 'react';
import { ChevronLeft, PackageCheck, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMall } from '../../context/MallContext';

interface MobileOrdersPageProps {
  mode: 'mini-program' | 'android-app';
}

export const MobileOrdersPage: React.FC<MobileOrdersPageProps> = ({ mode }) => {
  const { presentationOrders, setMpPage, setAndroidPage, triggerPendingFeature } = useMall();

  const goBack = () => {
    if (mode === 'mini-program') setMpPage('profile');
    else setAndroidPage('profile');
  };

  return (
    <div className="min-h-full bg-[#F5F7FA] pb-20 text-gray-800">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur">
        <button type="button" onClick={goBack} className="rounded-full p-1.5 hover:bg-gray-100" aria-label="返回个人中心">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-sm font-black">我的真实订单</h1>
          <p className="text-[10px] text-gray-500">数据来自统一生产订单接口</p>
        </div>
      </header>

      <main className="space-y-3 p-3">
        {presentationOrders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <PackageCheck className="mx-auto mb-2 h-10 w-10 text-blue-500" />
            <p className="text-sm font-bold">暂无生产订单</p>
            <p className="mt-1 text-[11px] text-gray-500">完成一次真实结算后，订单会同步显示在这里。</p>
          </div>
        ) : (
          presentationOrders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <p className="font-mono text-[10px] text-gray-500">{order.orderNo}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">{order.createdAt}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-[var(--sw-brand)]">{order.statusText}</span>
              </div>

              <div className="space-y-2 py-2">
                {order.items.slice(0, 3).map((item) => (
                  <div key={`${order.id}-${item.productId}`} className="flex items-center gap-2">
                    <img src={item.product.imageUrl} alt={item.productTitle} className="h-12 w-12 rounded-xl border border-gray-100 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{item.productTitle}</p>
                      <p className="text-[10px] text-gray-500">
                        ¥{item.priceAtPurchase.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  服务端订单
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#E5484D]">¥{order.totalAmount.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => triggerPendingFeature('移动端售后申请', `订单 ${order.orderNo} 已接入统一售后数据模型；退款审批仍需甲方确认流程。`)}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold"
                  >
                    <RotateCcw className="h-3 w-3" />
                    申请售后
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
};
