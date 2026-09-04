import type { ExperienceDocument } from './Experience';
import { themePreset } from './ThemePreset';

export function createExperienceDocument(application: string, title: string, announcement: string, source?: ExperienceDocument): ExperienceDocument {
  if (title.trim().length < 1 || title.trim().length > 80) throw new Error('EXPERIENCE_TITLE_INVALID');
  if (announcement.trim().length < 1 || announcement.trim().length > 240) throw new Error('EXPERIENCE_ANNOUNCEMENT_INVALID');
  if (source) return revisedDocument(application, title.trim(), announcement.trim(), source);
  return Object.freeze({
    version: 2,
    application,
    theme: themePreset('shop').theme,
    navigation: Object.freeze([{ id: `${application}:navigation:home`, label: '首页', page: `${application}:home` }]),
    assets: Object.freeze([]),
    pages: Object.freeze([
      Object.freeze({
        id: `${application}:home`,
        path: 'home',
        blocks: Object.freeze([
          Object.freeze({ id: `${application}:home:hero`, component: 'hero', content: Object.freeze({ title: title.trim(), subtitle: '企业福利，温暖抵达' }) }),
          Object.freeze({ id: `${application}:home:notice`, component: 'notice', content: Object.freeze({ announcement: announcement.trim() }) }),
        ]),
      }),
    ]),
  });
}

function revisedDocument(application: string, title: string, announcement: string, source: ExperienceDocument): ExperienceDocument {
  const pages = source.pages.map((page, index) => {
    if (index !== 0) return page;
    const blocks = [...page.blocks];
    const hero = blocks.findIndex((block) => block.component === 'hero');
    const notice = blocks.findIndex((block) => block.component === 'notice');
    const sourceHero = hero >= 0 ? blocks[hero] : undefined;
    const sourceNotice = notice >= 0 ? blocks[notice] : undefined;
    const heroBlock = Object.freeze({ ...sourceHero, id: sourceHero?.id ?? `${application}:home:hero`, component: 'hero' as const, content: Object.freeze({ ...(sourceHero?.content ?? {}), title }) });
    const noticeBlock = Object.freeze({ ...sourceNotice, id: sourceNotice?.id ?? `${application}:home:notice`, component: 'notice' as const, content: Object.freeze({ ...(sourceNotice?.content ?? {}), announcement }) });
    if (hero >= 0) blocks[hero] = heroBlock;
    else blocks.unshift(heroBlock);
    if (notice >= 0) blocks[notice] = noticeBlock;
    else blocks.push(noticeBlock);
    return Object.freeze({ ...page, blocks: Object.freeze(blocks) });
  });
  return Object.freeze({ version: 2, application, theme: source.theme, navigation: source.navigation, assets: source.assets, pages: Object.freeze(pages) });
}
