import { Bell, CreditCard, FileText, Heart, LogOut, MapPin, ShieldCheck, Ticket, Utensils } from 'lucide-react';
import type { useAccountViewModel } from '../viewmodel/AccountViewModel';
import { AddressPanel } from './AddressPanel';
import { FavoritePanel } from './FavoritePanel';
import { formatMinor } from '../../../shared/format/Money';

export function AccountPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useAccountViewModel> }>) {
  if (viewmodel.section === 'addresses') return <AddressPanel addresses={viewmodel.addresses} save={viewmodel.saveAddress} remove={viewmodel.removeAddress} notify={viewmodel.showToast} back={viewmodel.actions.profile} />;
  if (viewmodel.section === 'favorites')
    return <FavoritePanel favorites={viewmodel.favoriteItems} products={viewmodel.presentationProducts} open={viewmodel.actions.openProduct} remove={viewmodel.toggleFavorite} back={viewmodel.actions.profile} />;
  const actions = [
    { label: '我的卡券', icon: Ticket },
    { label: '我的收藏', icon: Heart, run: viewmodel.actions.favorites },
    { label: '收货地址', icon: MapPin, run: viewmodel.actions.addresses },
    { label: '发票信息', icon: FileText },
    { label: '消息通知', icon: Bell },
    { label: '安全中心', icon: ShieldCheck },
  ] as const;
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1000px] space-y-4">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-dark to-brand p-6 text-inverse shadow-xl">
          <button type="button" onClick={() => void viewmodel.logout()} className="absolute right-4 top-4 flex min-h-11 items-center gap-2 rounded-full bg-surface/10 px-4 text-xs font-bold">
            <LogOut size={15} />
            退出
          </button>
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-surface/15 text-2xl font-black">{viewmodel.user.name.slice(0, 1)}</span>
            <div>
              <h1 className="text-2xl font-black">{viewmodel.user.name}</h1>
              <p className="mt-1 text-sm text-inverse-label">
                {viewmodel.user.department} · {viewmodel.user.employeeId}
              </p>
              <p className="mt-1 text-xs text-inverse-label">{viewmodel.currentMall.mallName}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => viewmodel.openFeature('账户流水')} className="rounded-2xl bg-surface/10 p-4 text-left">
              <CreditCard />
              <span className="mt-3 block text-xs text-inverse-label">福利卡可用</span>
              <b className="text-2xl">¥{formatMinor(viewmodel.user.welfareBalanceMinor)}</b>
            </button>
            <button type="button" onClick={() => viewmodel.openFeature('账户流水')} className="rounded-2xl bg-surface/10 p-4 text-left">
              <Utensils />
              <span className="mt-3 block text-xs text-inverse-label">餐卡可用</span>
              <b className="text-2xl">¥{formatMinor(viewmodel.user.mealBalanceMinor)}</b>
            </button>
          </div>
        </section>
        <section className="rounded-3xl border border-edge bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-black">账户服务</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {actions.map(({ label, icon: Icon, ...item }) => (
              <button
                type="button"
                key={label}
                onClick={'run' in item && item.run ? item.run : () => viewmodel.openFeature(label)}
                className="flex min-h-20 items-center gap-3 rounded-2xl border border-edge p-4 text-left text-sm font-bold hover:border-brand hover:bg-brand-light"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-brand">
                  <Icon size={18} />
                </span>
                {label}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-edge bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">可切换商城</h2>
            <span className="text-xs text-muted">切换后重新建立授权上下文</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {viewmodel.malls.map((mall) => (
              <button
                type="button"
                disabled={mall.id === viewmodel.currentMall.id}
                onClick={() => mall.membershipId && viewmodel.switchMall(mall.membershipId)}
                key={mall.id}
                className="min-h-16 rounded-2xl border p-4 text-left disabled:border-brand disabled:bg-brand-light"
              >
                <b>{mall.mallName}</b>
                <span className="mt-1 block text-xs text-muted">{mall.badge}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
