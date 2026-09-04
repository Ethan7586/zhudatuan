import type { ApplicationDraft, Experience, ExperienceDetail, ExperienceDocument } from './Experience';

const codePattern = /^[A-Z][A-Z0-9_]{2,31}$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{2,47}$/;

export function assertApplicationDraft(draft: ApplicationDraft): void {
  if (draft.name.trim().length < 1 || draft.name.trim().length > 120) throw new Error('EXPERIENCE_NAME_INVALID');
  if (!codePattern.test(draft.code)) throw new Error('EXPERIENCE_CODE_INVALID');
  if (!slugPattern.test(draft.publicSlug)) throw new Error('EXPERIENCE_SLUG_INVALID');
}

export function experienceContent(detail: ExperienceDetail | undefined, record: Experience | undefined): Readonly<{ title: string; announcement: string }> {
  const blocks = detail?.head?.configuration.pages[0]?.blocks ?? [];
  const hero = blocks.find((block) => block.component === 'hero')?.content;
  const notice = blocks.find((block) => block.component === 'notice')?.content;
  return Object.freeze({
    title: typeof hero?.title === 'string' ? hero.title : (record?.name ?? '主打团福利商城'),
    announcement: typeof notice?.announcement === 'string' ? notice.announcement : '欢迎进入企业福利商城',
  });
}

export function createExperienceDocument(application: string, title: string, announcement: string): ExperienceDocument {
  if (title.trim().length < 1 || title.trim().length > 80) throw new Error('EXPERIENCE_TITLE_INVALID');
  if (announcement.trim().length < 1 || announcement.trim().length > 240) throw new Error('EXPERIENCE_ANNOUNCEMENT_INVALID');
  return Object.freeze({
    version: 2,
    application,
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
