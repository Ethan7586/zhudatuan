import { Gift } from 'lucide-react';
import type { ExperiencePage } from '@shop/contract';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { AccountSummary } from './AccountSummary';
import { DefaultHome } from './DefaultHome';
import { PublishedPage } from './PublishedPage';
import { experiencePath } from '../../../entity/session/model/PublishedExperience';

export function HomePage({ viewmodel, page }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel>; page?: ExperiencePage }>) {
  if (page && experiencePath(page.path) !== '/') return <div className="bg-[var(--sw-background)] px-3 py-4 sm:px-5"><div className="mx-auto max-w-[1280px]"><PublishedPage page={page} viewmodel={viewmodel} /></div></div>;
  return (
    <div className="bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto grid max-w-[1280px] gap-4 lg:grid-cols-[220px_1fr_260px]">
        <aside className="order-2 rounded-3xl border border-edge bg-surface p-4 shadow-sm lg:order-1">
          <div className="mb-3 flex items-center gap-2 font-black">
            <Gift size={18} className="text-brand" />
            全部分类
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {viewmodel.presentationCategories.slice(0, 8).map((category) => (
              <button type="button" key={category.id} onClick={() => viewmodel.openCategory(category.id)} className="min-h-11 rounded-xl px-3 text-left text-xs font-bold hover:bg-brand-light">
                {category.name}
                <span className="mt-0.5 block truncate text-[10px] font-normal text-muted">{category.description || '当前商城已发布'}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="order-1 min-w-0 space-y-4 lg:order-2">{page ? <PublishedPage page={page} viewmodel={viewmodel} /> : <DefaultHome viewmodel={viewmodel} />}</div>
        <div className="order-3">
          <AccountSummary viewmodel={viewmodel} />
        </div>
      </div>
    </div>
  );
}
