import {
  OP_EXPERIENCE_APPLICATIONS_COPY,
  OP_EXPERIENCE_APPLICATIONS_DETAIL_READ,
  OP_EXPERIENCE_APPLICATIONS_READ,
  OP_EXPERIENCE_VERSIONS_PUBLISH,
  OP_EXPERIENCE_VERSIONS_RESTORE,
  OP_EXPERIENCE_VERSIONS_SAVE,
  OP_EXPERIENCE_VERSIONS_VALIDATE,
  OP_ORGANIZATION_MALLS_CREATE,
} from '@shop/contract/ids';
import type { OperationId, OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

type ExperienceDto = DeepReadonly<OperationOutputFor<'experience.applications.read'>['items'][number]>;
export type ExperienceStatus = ExperienceDto['status'];
export type ExperienceView = 'all' | 'published' | 'drafts' | 'attention';
export type ExperienceBlockType = ExperienceBlock['component'];
export const EXPERIENCE_PAGE_LIMIT = 50;

export type ExperienceEntry = ExperienceDto['entry'];
export type Experience = ExperienceDto;
export type ExperiencePage = DeepReadonly<OperationOutputFor<'experience.applications.read'>>;
export type ExperienceDocument = DeepReadonly<OperationOutputFor<'experience.versions.save'>['configuration']>;
export type ExperienceBlock = ExperienceDocument['pages'][number]['blocks'][number];
export type ExperienceVersion = DeepReadonly<OperationOutputFor<'experience.versions.save'>>;
export type ExperienceHistory = DeepReadonly<OperationOutputFor<'experience.applications.detail.read'>['history'][number]>;
export type ExperienceDetail = DeepReadonly<OperationOutputFor<'experience.applications.detail.read'>>;

export interface ApplicationCopy {
  readonly targetMallId: string;
  readonly reason: string;
}
export interface VersionDraft {
  readonly application: string;
  readonly configuration: ExperienceDocument;
  readonly reason: string;
}

export type VersionValidation = DeepReadonly<OperationOutputFor<'experience.versions.validate'>>;
export type ValidationIssue = VersionValidation['issues'][number];
export type PublicationReceipt = DeepReadonly<OperationOutputFor<'experience.versions.publish'>>;
export type ExperienceAction = Readonly<{ kind: 'create' }> | Readonly<{ kind: 'copy'; record: Experience }> | Readonly<{ kind: 'manage'; record: Experience }> | Readonly<{ kind: 'design'; record: Experience }>;

export const experienceOperations = Object.freeze({
  create: OP_ORGANIZATION_MALLS_CREATE,
  copy: OP_EXPERIENCE_APPLICATIONS_COPY,
  readDetail: OP_EXPERIENCE_APPLICATIONS_DETAIL_READ,
  read: OP_EXPERIENCE_APPLICATIONS_READ,
  save: OP_EXPERIENCE_VERSIONS_SAVE,
  validate: OP_EXPERIENCE_VERSIONS_VALIDATE,
  publish: OP_EXPERIENCE_VERSIONS_PUBLISH,
  restore: OP_EXPERIENCE_VERSIONS_RESTORE,
} satisfies Readonly<Record<string, OperationId>>);
