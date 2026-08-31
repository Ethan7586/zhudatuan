import { createFetchExperienceApplicationsRead } from '@shop/sdk/experience';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ExperiencePageSchema } from './ExperienceSchema';

const applicationsRead = createFetchExperienceApplicationsRead(appConfig.apiBaseUrl);

export const applicationKey = (context: ConsoleContext, cursor?: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'experience.applications.read', cursor ?? null, 50] as const);

export async function readExperiences(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  const value = await applicationsRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  return ExperiencePageSchema.parse(value);
}
