import type { ImportKind } from './Task';

export interface ImportProvider {
  readonly value: string;
  readonly label: string;
}

export interface ImportProviderOptions {
  readonly items: readonly ImportProvider[];
  readonly reason: string | null;
}

export interface ImportDraft {
  readonly step: 1 | 2 | 3;
  readonly kind: ImportKind;
  readonly file: File | null;
  readonly provider: string;
  readonly partnerId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly openingMinor: string;
  readonly closingMinor: string;
  readonly pool: string;
  readonly confirmed: boolean;
}

export function emptyImportDraft(kind: ImportKind): ImportDraft {
  return Object.freeze({ step: 1, kind, file: null, provider: '', partnerId: '', periodStart: '', periodEnd: '', openingMinor: '', closingMinor: '', pool: '', confirmed: false });
}
