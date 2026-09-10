import { Megaphone, ShieldCheck } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';

export function MallNotice({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const message = viewmodel.currentMall.welcomeBanner.trim();
  if (!message) return null;
  return (
    <section aria-label="商城公告" className="mx-auto mb-3 hidden min-h-10 max-w-[1280px] items-center justify-between gap-4 rounded-xl bg-brand-ink px-4 py-2 text-xs text-inverse lg:flex">
      <p className="flex min-w-0 items-center gap-2">
        <Megaphone size={15} className="shrink-0 text-warning" aria-hidden="true" />
        <b className="shrink-0 text-warning">企业公告</b>
        <span className="truncate text-inverse-label" title={message}>
          {message}
        </span>
      </p>
      <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-inverse-label">
        <ShieldCheck size={14} className="text-success" aria-hidden="true" />
        价格、库存与购买资格实时核验
      </p>
    </section>
  );
}
