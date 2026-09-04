import { OP_EXPERIENCE_APPLICATIONS_DETAIL_READ, OP_EXPERIENCE_APPLICATIONS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { EXPERIENCE_PAGE_LIMIT } from '../model/Experience';

export const applicationsKey = (context: ConsoleContext, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_EXPERIENCE_APPLICATIONS_READ, cursor ?? null, EXPERIENCE_PAGE_LIMIT] as const);
export const applicationDetailKey = (context: ConsoleContext, application: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_EXPERIENCE_APPLICATIONS_DETAIL_READ, application] as const);
