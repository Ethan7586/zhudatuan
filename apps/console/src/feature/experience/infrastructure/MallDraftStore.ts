import type { MallOpeningDraft } from '../model/MallDraft';
import type { MallDraftPort } from '../public';

const persistedFields = Object.freeze([
  'parentId',
  'name',
  'code',
  'publicSlug',
  'brandName',
  'domainMode',
  'customDomain',
  'timezone',
  'currency',
  'themePreset',
  'primaryColor',
  'accentColor',
  'storeType',
  'primaryCategory',
  'businessMode',
  'certificateMode',
  'miniProgramMode',
  'officialAccountMode',
  'paymentPlan',
  'deliveryMode',
  'invoiceMode',
  'status',
] as const satisfies readonly (keyof MallOpeningDraft)[]);

export class MallDraftStore implements MallDraftPort {
  load(key: string, fallback: MallOpeningDraft): MallOpeningDraft {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
      const source = parsed as Readonly<Record<string, unknown>>;
      const safe: Record<string, string> = {};
      for (const field of persistedFields) if (typeof source[field] === 'string') safe[field] = source[field];
      return Object.freeze({ ...fallback, ...safe });
    } catch {
      return fallback;
    }
  }
  save(key: string, draft: MallOpeningDraft): void {
    const safe: Record<string, string> = {};
    for (const field of persistedFields) safe[field] = draft[field];
    sessionStorage.setItem(key, JSON.stringify(safe));
  }
  clear(key: string): void {
    sessionStorage.removeItem(key);
  }
}
