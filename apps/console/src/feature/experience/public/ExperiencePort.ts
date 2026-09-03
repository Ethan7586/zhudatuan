import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ApplicationDraft, ApplicationUpdate, Experience, ExperienceDetail, ExperiencePage, ExperienceVersion, PublicationReceipt, VersionDraft, VersionValidation } from '../model/Experience';

export interface ExperiencePort {
  applications(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ExperiencePage>;
  application(context: ConsoleContext, application: string, signal?: AbortSignal): Promise<ExperienceDetail>;
  create(context: ConsoleContext, draft: ApplicationDraft, identity: string, signal?: AbortSignal): Promise<Experience>;
  copy(context: ConsoleContext, application: string, draft: ApplicationDraft, reason: string, identity: string, signal?: AbortSignal): Promise<Experience>;
  update(context: ConsoleContext, application: string, version: number, change: ApplicationUpdate, identity: string, signal?: AbortSignal): Promise<Experience>;
  saveVersion(context: ConsoleContext, draft: VersionDraft, identity: string, signal?: AbortSignal): Promise<ExperienceVersion>;
  validateVersion(context: ConsoleContext, version: string, identity: string, signal?: AbortSignal): Promise<VersionValidation>;
  publishVersion(context: ConsoleContext, version: string, applicationVersion: number, proof: string, identity: string, signal?: AbortSignal): Promise<PublicationReceipt>;
  restoreVersion(context: ConsoleContext, version: string, reason: string, proof: string, identity: string, signal?: AbortSignal): Promise<ExperienceVersion>;
}
