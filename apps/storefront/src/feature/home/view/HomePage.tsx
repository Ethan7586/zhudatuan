import type { ExperiencePage } from '@shop/contract';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { AccountSummary } from './AccountSummary';
import { CategoryGrid } from './CategoryGrid';
import { DefaultHome } from './DefaultHome';
import { PublishedPage } from './PublishedPage';
import { experiencePath } from '../../../entity/session/model/PublishedExperience';

export function HomePage({ viewmodel, page }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel>; page?: ExperiencePage }>) {
  if (page && experiencePath(page.path) !== '/')
    return (
      <div className="bg-[var(--sw-background)] px-3 py-4 sm:px-5">
        <div className="mx-auto max-w-[1280px]">
          <PublishedPage page={page} viewmodel={viewmodel} />
        </div>
      </div>
    );
  return (
    <div className="bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto grid max-w-[1280px] gap-4 lg:grid-cols-[220px_1fr_260px]">
        <CategoryGrid viewmodel={viewmodel} />
        <div className="order-3 min-w-0 space-y-4 lg:order-2">{page ? <PublishedPage page={page} viewmodel={viewmodel} /> : <DefaultHome viewmodel={viewmodel} />}</div>
        <div className="order-1 lg:order-3">
          <AccountSummary viewmodel={viewmodel} />
        </div>
      </div>
    </div>
  );
}
