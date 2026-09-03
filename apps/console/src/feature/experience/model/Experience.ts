import type { OperationId } from '@shop/contract';
import type { ContractJsonObject } from '@shop/contract/schema';

export type ExperienceStatus = 'draft' | 'active' | 'disabled';
export type ExperienceView = 'all' | 'published' | 'drafts' | 'attention';
export type ExperienceBlockType = 'hero' | 'notice' | 'shortcut' | 'productcollection' | 'richtext';
export const EXPERIENCE_PAGE_LIMIT = 50;

export type ExperienceEntry =
  | Readonly<{ handle: string; url: string; state: 'ready'; releaseId: string; releaseVersion: string; contentHash: string }>
  | Readonly<{ handle: string; url: string; state: 'unpublished' }>
  | Readonly<{ handle: string; url: string; state: 'disabled' }>
  | Readonly<{ handle: string; url: string; state: 'invalid'; requestId: string }>;

export interface Experience {
  readonly id: string;
  readonly mallId: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly status: ExperienceStatus;
  readonly version: number;
  readonly headSequence: number | null;
  readonly publishedSequence: number | null;
  readonly entry: ExperienceEntry;
  readonly updatedAt: string;
}

export interface ExperiencePage {
  readonly items: readonly Experience[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface ExperienceBlock {
  readonly id: string;
  readonly component: ExperienceBlockType;
  readonly content: ContractJsonObject;
  readonly action?: Readonly<{ type: 'link' | 'product' | 'category' | 'collection' | 'exchangeableproduct' | 'micropage' | 'marketingactivity'; target: string }> | undefined;
}

export interface ExperienceDocument {
  readonly version: 2;
  readonly application: string;
  readonly pages: readonly Readonly<{ id: string; path: string; blocks: readonly ExperienceBlock[] }>[];
}

export interface ExperienceVersion {
  readonly id: string;
  readonly application_id: string;
  readonly sequence: number;
  readonly schema_version: '2';
  readonly configuration: ExperienceDocument;
  readonly configuration_hash: string;
  readonly validation_state: 'pending' | 'valid' | 'invalid';
  readonly reason: string;
  readonly created_by: string;
  readonly created_at: string;
}

export interface ExperienceHistory {
  readonly id: string;
  readonly sequence: number;
  readonly schemaVersion: '2';
  readonly validationState: 'pending' | 'valid' | 'invalid';
  readonly reason: string;
  readonly createdAt: string;
  readonly lifecycle: 'published' | 'draft';
}

export interface ExperienceDetail extends Experience {
  readonly head: ExperienceVersion | null;
  readonly published: ExperienceVersion | null;
  readonly history: readonly ExperienceHistory[];
}

export interface ApplicationDraft { readonly code: string; readonly publicSlug: string; readonly name: string }
export interface ApplicationUpdate { readonly name: string; readonly status: ExperienceStatus }
export interface VersionDraft { readonly application: string; readonly configuration: ExperienceDocument; readonly reason: string }

export interface VersionValidation { readonly id: string; readonly application_id: string; readonly validation_state: 'valid' | 'invalid' }
export interface PublicationReceipt { readonly id: string; readonly application_id: string; readonly version_id: string; readonly pool_id: string; readonly state: 'scheduled' | 'active' | 'retired' | 'failed'; readonly effective_at: string; readonly retired_at: string | null; readonly published_by: string }
export type ExperienceAction = Readonly<{ kind: 'create' }> | Readonly<{ kind: 'copy' | 'manage' | 'design'; record: Experience }>;

export const experienceOperations = Object.freeze({
  create: 'experience.applications.create', copy: 'experience.applications.copy', readDetail: 'experience.applications.detail.read', read: 'experience.applications.read', update: 'experience.applications.update',
  save: 'experience.versions.save', validate: 'experience.versions.validate', publish: 'experience.versions.publish', restore: 'experience.versions.restore',
} satisfies Readonly<Record<string, OperationId>>);
