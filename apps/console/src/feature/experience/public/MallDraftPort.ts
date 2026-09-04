import type { MallOpeningDraft } from '../model/MallDraft';

export interface MallDraftPort {
  load(key: string, fallback: MallOpeningDraft): MallOpeningDraft;
  save(key: string, draft: MallOpeningDraft): void;
  clear(key: string): void;
}
