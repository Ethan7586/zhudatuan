import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ApplicationCopy, Experience, ExperienceDetail, ExperiencePage, ExperienceVersion, PublicationReceipt, VersionDraft, VersionValidation } from '../model/Experience';

export interface ExperiencePort {
  applications(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ExperiencePage>;
  application(context: ConsoleContext, application: string, signal?: AbortSignal): Promise<ExperienceDetail>;
  copy(context: ConsoleContext, application: string, copy: ApplicationCopy, identity: string, signal?: AbortSignal): Promise<Experience>;
  saveVersion(context: ConsoleContext, draft: VersionDraft, expectedVersion: number, identity: string, signal?: AbortSignal): Promise<ExperienceVersion>;
  validateVersion(context: ConsoleContext, version: string, identity: string, signal?: AbortSignal): Promise<VersionValidation>;
  publishVersion(context: ConsoleContext, version: string, applicationVersion: number, identity: string, signal?: AbortSignal): Promise<PublicationReceipt>;
  restoreVersion(context: ConsoleContext, version: string, applicationVersion: number, reason: string, identity: string, signal?: AbortSignal): Promise<ExperienceVersion>;
}
