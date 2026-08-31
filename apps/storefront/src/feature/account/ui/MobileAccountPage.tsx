import { Bell, CheckCircle, ChevronRight, Clock, CreditCard, FileText, Headphones, Heart, MapPin, Package, ShieldCheck, Ticket, Truck, Utensils } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAccountRuntime } from '../application/AccountRuntime';
import type { MobileChannel } from '../../../shared/manifest/StorefrontChannel';
import { formatMinor } from '../../../shared/format/Money';
import { AddressPanel } from './AddressPanel';
import { FavoritePanel } from './FavoritePanel';

export function MobileAccountPage({ channel, onAfterSale }: { readonly channel: MobileChannel; readonly onAfterSale: (orderId: string) => void }) {
  const account = useAccountRuntime();
  const { user, currentMall, presentationOrders, logout, openFeature } = account;
  const [search] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === '/profile' && search.get('section') === 'addresses')
    return <AddressPanel addresses={account.addresses} save={account.saveAddress} remove={account.removeAddress} notify={account.showToast} back={() => void navigate('/profile')} />;
  if (location.pathname === '/profile' && search.get('section') === 'favorites')
    return <FavoritePanel favorites={account.favorites} products={account.presentationProducts} open={(id) => void navigate(`/products/${encodeURIComponent(id)}`)} remove={account.toggleFavorite} back={() => void navigate('/profile')} />;
  const status = location.pathname === '/orders' ? search.get('status') : null;
  const visibleOrders = status ? presentationOrders.filter((order) => order.status === status) : presentationOrders;
  const orderStates = [
    { label: '待付款', icon: Clock },
    { label: '待发货', icon: Package },
    { label: '待收货', icon: Truck },
    { label: '已完成', icon: CheckCircle },
    { label: '售后', icon: Headphones },
  ];
  const actions = [
    { label: '我的卡券', icon: Ticket },
    { label: '我的收藏', icon: Heart },
    { label: '收货地址', icon: MapPin },
    { label: '发票信息', icon: FileText },
    { label: '消息通知', icon: Bell },
    { label: '联系客服', icon: Headphones },
    { label: '安全中心', icon: ShieldCheck },
  ];
  return (
    <div className="space-y-3 px-3 py-3">
      <section className={`overflow-hidden rounded-2xl p-4 text-white ${channel === 'android' ? 'bg-gradient-to-br from-slate-900 to-blue-800' : 'bg-gradient-to-br from-emerald-700 to-teal-500'}`}>
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/20 text-xl font-black">{user.name.slice(0, 1)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">{user.name}</h1>
            <p className="truncate text-xs text-white/75">
              {user.department} · {user.employeeId}
            </p>
            <p className="mt-1 truncate text-[10px] text-white/70">{currentMall.mallName}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="rounded-full bg-white/15 px-3 py-1.5 text-xs">
            退出
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 p-3">
            <CreditCard size={17} />
            <div className="mt-2 text-[10px] opacity-75">福利卡</div>
            <b>¥{formatMinor(user.welfareBalanceMinor)}</b>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <Utensils size={17} />
            <div className="mt-2 text-[10px] opacity-75">餐卡</div>
            <b>¥{formatMinor(user.mealBalanceMinor)}</b>
          </div>
        </div>
      </section>
      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between px-1 pb-3">
          <h2 className="text-sm font-black">我的订单</h2>
          <button type="button" onClick={() => openFeature('订单')} className="flex items-center text-[11px] text-slate-500">
            全部 {presentationOrders.length}
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-5">
          {orderStates.map(({ label, icon: Icon }) => (
            <button type="button" key={label} onClick={() => openFeature(label)} className="relative flex flex-col items-center gap-1 text-[10px] text-slate-600">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Icon size={18} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>
      {visibleOrders.slice(0, location.pathname === '/orders' ? 50 : 3).map((order) => (
        <article key={order.id} className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between border-b pb-2 text-xs">
            <b>{order.orderNo}</b>
            <span className="font-semibold text-blue-600">{order.statusText}</span>
          </div>
          <div className="mt-3 flex gap-3">
            <img src={order.items[0]?.product.image ?? ''} alt="" className="h-16 w-16 rounded-xl bg-slate-100 object-cover" />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-xs font-bold">{order.items[0]?.product.title ?? '企业福利订单'}</div>
              <div className="mt-2 text-[10px] text-slate-500">共 {order.items.length} 件商品</div>
            </div>
            <div className="text-right text-xs">
              <b>¥{order.totalAmount.toFixed(2)}</b>
              <button type="button" onClick={() => void navigate(`/orders/${encodeURIComponent(order.orderId)}`)} className="mt-2 block w-full rounded-lg bg-blue-600 px-2 py-1 font-bold text-white">
                订单与物流
              </button>
              <button type="button" onClick={() => onAfterSale(order.orderId)} className="mt-2 block rounded-lg border px-2 py-1 font-bold text-blue-600">
                售后与退款
              </button>
            </div>
          </div>
        </article>
      ))}
      {location.pathname === '/orders' && visibleOrders.length === 0 ? <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed bg-white text-sm text-slate-400">当前状态暂无订单</div> : null}
      <section className="grid grid-cols-3 gap-y-5 rounded-2xl bg-white p-4 shadow-sm">
        {actions.map(({ label, icon: Icon }) => (
          <button type="button" key={label} onClick={() => openFeature(label)} className="flex flex-col items-center gap-1.5 text-[11px] text-slate-600">
            <Icon size={21} className="text-slate-700" />
            {label}
          </button>
        ))}
      </section>
    </div>
  );
}
