import type { ExperiencePage } from '@shop/contract';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { AccountSummary } from './AccountSummary';
import { CategoryGrid } from './CategoryGrid';
import { DefaultHome } from './DefaultHome';
import { HomeShortcuts } from './HomeShortcuts';
import { PublishedPage } from './PublishedPage';
import { experiencePath } from '../../../entity/session/model/PublishedExperience';
import { CategoryShortcuts } from './CategoryShortcuts';
import { MallNotice } from './MallNotice';

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
      <MallNotice viewmodel={viewmodel} />
      <div className="mx-auto grid max-w-[1280px] gap-4 lg:grid-cols-[220px_1fr_260px]">
        <div data-home-layout="mobile" className="lg:hidden">
          <AccountSummary viewmodel={viewmodel} />
        </div>
        <CategoryGrid viewmodel={viewmodel} layout="rail" />
        <div className="min-w-0 space-y-4">
          <HomeShortcuts viewmodel={viewmodel} />
          {page ? (
            <PublishedPage
              page={page}
              viewmodel={viewmodel}
              afterHero={
                <>
                  <CategoryShortcuts viewmodel={viewmodel} />
                  <CategoryGrid viewmodel={viewmodel} layout="scenes" />
                </>
              }
            />
          ) : (
            <DefaultHome viewmodel={viewmodel} />
          )}
        </div>
        <div data-home-layout="desktop" className="hidden lg:block">
          <AccountSummary viewmodel={viewmodel} />
        </div>
      </div>
    </div>
  );
}
