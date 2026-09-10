import { createFetchSupportCasesCreate, createFetchSupportMessagesSend } from '@shop/sdk/support';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { SupportCaseSchema } from './SupportSchema';

const casesCreate = createFetchSupportCasesCreate(appConfig.apiBaseUrl);
const messagesSend = createFetchSupportMessagesSend(appConfig.apiBaseUrl);
const MESSAGE_LIMIT = 4000;

export interface CreateSupportCaseDraft {
  readonly message: string;
  readonly subject: string;
}

export interface SendSupportMessageDraft {
  readonly caseId: string;
  readonly caseVersion: number;
  readonly caseState: string;
  readonly message: string;
}

export function canCreateSupportCase(context: ConsoleContext): boolean {
  return context.session.csrf !== undefined
    && context.session.permissions.includes('support.case.create')
    && context.session.capabilities.includes('support.cases.create');
}

export async function createSupportCase(
  context: ConsoleContext,
  draft: CreateSupportCaseDraft,
  signal?: AbortSignal,
) {
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('SUPPORT_CASE_CSRF_MISSING');
  if (!canCreateSupportCase(context)) throw new Error('SUPPORT_CASE_CREATE_NOT_AVAILABLE');
  const value = await casesCreate(
    { body: { subject: draft.subject.trim(), message: draft.message.trim(), channel: 'inapp', priority: 'normal' } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return SupportCaseSchema.parse(value);
}

export function canSendSupportMessage(context: ConsoleContext, caseState: string): boolean {
  return context.session.csrf !== undefined
    && context.session.permissions.includes('support.message.send')
    && context.session.capabilities.includes('support.messages.send')
    && caseState.trim().toLowerCase() !== 'closed';
}

export async function sendSupportMessage(
  context: ConsoleContext,
  draft: SendSupportMessageDraft,
  signal?: AbortSignal,
) {
  assertSendAvailable(context, draft.caseState);
  const message = draft.message.trim();
  if (message.length === 0) throw new Error('SUPPORT_MESSAGE_EMPTY');
  if (message.length > MESSAGE_LIMIT) throw new Error('SUPPORT_MESSAGE_TOO_LONG');

  return messagesSend(
    { path: { caseid: draft.caseId }, body: { message } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: draft.caseVersion,
      csrfToken: context.session.csrf!,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
}

function assertSendAvailable(context: ConsoleContext, caseState: string): void {
  if (context.session.csrf === undefined) throw new Error('SUPPORT_MESSAGE_CSRF_MISSING');
  if (!context.session.permissions.includes('support.message.send')
    || !context.session.capabilities.includes('support.messages.send')) {
    throw new Error('SUPPORT_MESSAGE_NOT_AVAILABLE');
  }
  if (caseState.trim().toLowerCase() === 'closed') throw new Error('SUPPORT_CASE_CLOSED');
}
