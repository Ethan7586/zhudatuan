import { createFetchExperienceApplicationsRead } from '@shop/sdk/experience';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ApplicationPageSchema } from './ApplicationSchema';

const applicationsRead = createFetchExperienceApplicationsRead(appConfig.apiBaseUrl);

<<<<<<< HEAD
export const applicationRootKey = (context: ConsoleContext) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'experience.applications.read'] as const);

export const applicationKey = (context: ConsoleContext, cursor?: string) => Object.freeze([...applicationRootKey(context), cursor ?? null, 50] as const);

export async function readApplications(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  const value = await applicationsRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
=======
export const applicationKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'experience.applications.read', cursor ?? null, 50,
] as const);

export async function readApplications(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  const value = await applicationsRead({ query: { limit: 50,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  return ApplicationPageSchema.parse(value);
}
