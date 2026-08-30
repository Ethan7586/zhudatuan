import { createFetchSupportMessagesSend } from '@shop/sdk/support';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const messagesSend = createFetchSupportMessagesSend(appConfig.apiBaseUrl);
const MESSAGE_LIMIT = 4000;

export interface SendSupportMessageDraft {
  readonly caseId: string;
  readonly caseVersion: number;
  readonly caseState: string;
  readonly message: string;
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
