import { createFetchSupportAttachmentsCreate, createFetchSupportCasesCreate, createFetchSupportCasesUpdate,
  createFetchSupportMessagesSend } from '@shop/sdk/support';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { SupportCaseSchema, type SupportMessageVisibility } from './SupportSchema';
import { supportPriorityFromGrade, type SupportPriorityGrade } from './SupportPresentation';

const casesCreate = createFetchSupportCasesCreate(appConfig.apiBaseUrl);
const messagesSend = createFetchSupportMessagesSend(appConfig.apiBaseUrl);
const casesUpdate = createFetchSupportCasesUpdate(appConfig.apiBaseUrl);
const attachmentsCreate = createFetchSupportAttachmentsCreate(appConfig.apiBaseUrl);
const MESSAGE_LIMIT = 4000;
const ATTACHMENT_LIMIT = 1024 * 1024;
const ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);

export interface CreateSupportCaseDraft {
  readonly message: string;
  readonly subject: string;
}

export interface SendSupportMessageDraft {
  readonly caseId: string;
  readonly caseVersion: number;
  readonly caseState: string;
  readonly message: string;
  readonly visibility: SupportMessageVisibility;
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

export function canReviewSupportCase(context: ConsoleContext): boolean {
  return context.session.csrf !== undefined
    && context.session.permissions.includes('support.case.manage')
    && context.session.capabilities.includes('support.cases.update');
}

export async function reviewSupportPriority(context: ConsoleContext, caseId: string, caseVersion: number,
  grade: SupportPriorityGrade, signal?: AbortSignal) {
  if (!canReviewSupportCase(context)) throw new Error('SUPPORT_PRIORITY_REVIEW_NOT_AVAILABLE');
  return SupportCaseSchema.parse(await casesUpdate({ path: { caseid: caseId }, body: { priority: supportPriorityFromGrade(grade) } },
    consoleCommand(context.scope, { accessVersion: context.session.accessVersion, expectedVersion: caseVersion,
      csrfToken: context.session.csrf!, ...(signal === undefined ? {} : { signal }) })));
}

export function canUploadSupportAttachment(context: ConsoleContext, caseState: string): boolean {
  return context.session.csrf !== undefined
    && context.session.permissions.includes('support.message.send')
    && context.session.capabilities.includes('support.attachments.create')
    && caseState.trim().toLowerCase() !== 'closed';
}

export async function uploadSupportAttachment(context: ConsoleContext, caseId: string, caseState: string, file: File,
  visibility: SupportMessageVisibility, signal?: AbortSignal) {
  if (!canUploadSupportAttachment(context, caseState)) throw new Error('SUPPORT_ATTACHMENT_NOT_AVAILABLE');
  if (!ATTACHMENT_TYPES.has(file.type)) throw new Error('SUPPORT_ATTACHMENT_TYPE_INVALID');
  if (file.size < 1 || file.size > ATTACHMENT_LIMIT) throw new Error('SUPPORT_ATTACHMENT_TOO_LARGE');
  return attachmentsCreate({ path: { caseid: caseId }, body: { name: file.name, contentType: file.type,
    contentBase64: await fileBase64(file), visibility } }, consoleCommand(context.scope, { accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!, ...(signal === undefined ? {} : { signal }) }));
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
    { path: { caseid: draft.caseId }, body: { message, visibility: draft.visibility } },
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

async function fileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}
