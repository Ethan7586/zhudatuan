import { parseExperience, type ExperienceDocument, type ExperiencePage } from '@shop/contract';
import type { StorefrontBootstrap } from './Bootstrap';

export function publishedExperience(view: StorefrontBootstrap | undefined): ExperienceDocument | null {
  if (!view || view.experience.state !== 'complete' || view.experience.data === null) return null;
  return parseExperience(view.experience.data);
}

export function experiencePath(value: string): string | null {
  const path = value.trim();
  if (path === '' || path === '/' || path === 'home') return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return /^\/(?:page|pages)\/[a-z0-9][a-z0-9/-]*$/i.test(normalized) && !normalized.includes('//') ? normalized : null;
}

export function experiencePage(document: ExperienceDocument | null, pathname: string): ExperiencePage | null {
  if (!document) return null;
  const normalized = pathname === '' ? '/' : pathname.replace(/\/$/, '') || '/';
  return document.pages.find((page) => experiencePath(page.path) === normalized) ?? null;
}
