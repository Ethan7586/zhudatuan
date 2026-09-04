import { createFetchExperienceApplicationsCopy, createFetchExperienceApplicationsCreate, createFetchExperienceApplicationsUpdate } from '@shop/sdk/experience';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import type { ApplicationCopyDraft, ApplicationCreateDraft, ApplicationEditDraft } from './ApplicationSchema';

const applicationsCreate = createFetchExperienceApplicationsCreate(appConfig.apiBaseUrl);
const applicationsUpdate = createFetchExperienceApplicationsUpdate(appConfig.apiBaseUrl);
const applicationsCopy = createFetchExperienceApplicationsCopy(appConfig.apiBaseUrl);

export type ApplicationCommandOperation = 'experience.applications.create' | 'experience.applications.update' | 'experience.applications.copy';

export function applicationCommandAvailable(context: ConsoleContext, operation: ApplicationCommandOperation): boolean {
  return context.session.csrf !== undefined && context.session.permissions.includes('experience.application.manage') && context.session.capabilities.includes(operation);
}

export async function createApplication(context: ConsoleContext, draft: ApplicationCreateDraft, signal?: AbortSignal) {
  return applicationsCreate({ body: draft }, commandContext(context, 'experience.applications.create', undefined, signal));
}

export async function editApplication(context: ConsoleContext, applicationId: string, expectedVersion: number, draft: ApplicationEditDraft, signal?: AbortSignal) {
  return applicationsUpdate({ path: { applicationid: applicationId }, body: draft }, commandContext(context, 'experience.applications.update', expectedVersion, signal));
}

export async function disableApplication(context: ConsoleContext, applicationId: string, expectedVersion: number, signal?: AbortSignal) {
  return applicationsUpdate({ path: { applicationid: applicationId }, body: { status: 'disabled' } }, commandContext(context, 'experience.applications.update', expectedVersion, signal));
}

export async function copyApplication(context: ConsoleContext, sourceApplicationId: string, draft: ApplicationCopyDraft, signal?: AbortSignal) {
  return applicationsCopy({ path: { applicationid: sourceApplicationId }, body: draft }, commandContext(context, 'experience.applications.copy', undefined, signal));
}

function commandContext(context: ConsoleContext, operation: ApplicationCommandOperation, expectedVersion?: number, signal?: AbortSignal) {
  if (!applicationCommandAvailable(context, operation)) throw new Error('EXPERIENCE_APPLICATION_COMMAND_NOT_AVAILABLE');
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    csrfToken: context.session.csrf!,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(signal === undefined ? {} : { signal }),
  });
}
