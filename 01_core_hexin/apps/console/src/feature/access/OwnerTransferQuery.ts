import {
  createFetchAccessOwnershipRead,
  createFetchAccessOwnershipTransfersAccept,
  createFetchAccessOwnershipTransfersAcceptPreview,
  createFetchAccessOwnershipTransfersCancel,
  createFetchAccessOwnershipTransfersCancelPreview,
  createFetchAccessOwnershipTransfersCreate,
  createFetchAccessOwnershipTransfersPreview,
} from '@shop/sdk/access';
import {
  createFetchIdentityMobileChallenge,
  createFetchIdentityMobileManage,
  createFetchIdentityPasswordVerify,
} from '@shop/sdk/identity';
import type { ConsoleContext, ConsoleSession } from '../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import {
  OwnerTransferAcceptedSchema,
  OwnerTransferAcceptPreviewSchema,
  OwnerTransferPreviewSchema,
  OwnerTransferSchema,
  OwnershipStateSchema,
  MobileManageReceiptSchema,
  PhoneChangeChallengeSchema,
  PasswordVerificationSchema,
  type FormerOwnerMode,
} from './OwnerTransferSchema';

export { completeStepUpAndReadSession, requestStepUp } from '../../entity/session/StepUpCommand';

const ownershipRead = createFetchAccessOwnershipRead(appConfig.apiBaseUrl);
const transferPreview = createFetchAccessOwnershipTransfersPreview(appConfig.apiBaseUrl);
const transferCreate = createFetchAccessOwnershipTransfersCreate(appConfig.apiBaseUrl);
const transferAcceptPreview = createFetchAccessOwnershipTransfersAcceptPreview(appConfig.apiBaseUrl);
const transferAccept = createFetchAccessOwnershipTransfersAccept(appConfig.apiBaseUrl);
const transferCancelPreview = createFetchAccessOwnershipTransfersCancelPreview(appConfig.apiBaseUrl);
const transferCancel = createFetchAccessOwnershipTransfersCancel(appConfig.apiBaseUrl);
const mobileChallenge = createFetchIdentityMobileChallenge(appConfig.apiBaseUrl);
const mobileManage = createFetchIdentityMobileManage(appConfig.apiBaseUrl);
const passwordVerify = createFetchIdentityPasswordVerify(appConfig.apiBaseUrl);

export interface TransferConfiguration {
  readonly targetMembership: string;
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole?: string;
}

export const ownershipKey = (context: ConsoleContext) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'access.ownership.read',
] as const);

export async function readOwnership(context: ConsoleContext, signal?: AbortSignal) {
  const value = await ownershipRead({}, consoleRequest(context.scope, signal, context.session.accessVersion));
  return OwnershipStateSchema.parse(value);
}

export async function previewTransfer(
  context: ConsoleContext,
  session: ConsoleSession,
  configuration: TransferConfiguration,
  ownershipVersion: number,
  signal?: AbortSignal,
) {
  const body = transferBody(configuration);
  const value = await transferPreview({ body }, command(context, session, ownershipVersion, undefined, signal));
  return OwnerTransferPreviewSchema.parse(value);
}

export async function createTransfer(
  context: ConsoleContext,
  session: ConsoleSession,
  configuration: TransferConfiguration,
  ownershipVersion: number,
  proof: string,
  signal?: AbortSignal,
) {
  const body = transferBody(configuration);
  const value = await transferCreate({ body }, command(context, session, ownershipVersion, proof, signal));
  return OwnerTransferSchema.parse(value);
}

export async function previewAccept(
  context: ConsoleContext,
  session: ConsoleSession,
  transferId: string,
  transferVersion: number,
  signal?: AbortSignal,
) {
  const value = await transferAcceptPreview(
    { path: { transferid: transferId }, body: {} },
    command(context, session, transferVersion, undefined, signal),
  );
  return OwnerTransferAcceptPreviewSchema.parse(value);
}

export async function acceptTransfer(
  context: ConsoleContext,
  session: ConsoleSession,
  transferId: string,
  transferVersion: number,
  proof: string,
  signal?: AbortSignal,
) {
  const value = await transferAccept(
    { path: { transferid: transferId }, body: {} },
    command(context, session, transferVersion, proof, signal),
  );
  return OwnerTransferAcceptedSchema.parse(value);
}

export async function previewCancel(
  context: ConsoleContext,
  session: ConsoleSession,
  transferId: string,
  transferVersion: number,
  reason: string,
  signal?: AbortSignal,
) {
  const value = await transferCancelPreview(
    { path: { transferid: transferId }, body: { reason } },
    command(context, session, transferVersion, undefined, signal),
  );
  return OwnerTransferAcceptPreviewSchema.parse(value);
}

export async function cancelTransfer(
  context: ConsoleContext,
  session: ConsoleSession,
  transferId: string,
  transferVersion: number,
  reason: string,
  proof: string,
  signal?: AbortSignal,
) {
  const value = await transferCancel(
    { path: { transferid: transferId }, body: { reason } },
    command(context, session, transferVersion, proof, signal),
  );
  return OwnerTransferSchema.parse(value);
}

export async function requestCanonicalMobileChallenge(
  session: ConsoleSession,
  mainlandMobile: string,
  signal?: AbortSignal,
) {
  const mobile = canonicalMainlandMobile(mainlandMobile);
  const value = await mobileChallenge(
    { body: { destination: mobile } },
    sessionCommand(session, signal),
  );
  return PhoneChangeChallengeSchema.parse(value);
}

export async function verifyPasswordForMobileEnrollment(
  session: ConsoleSession,
  password: string,
  signal?: AbortSignal,
) {
  if (password.length === 0 || password.length > 128) throw new Error('OWNER_PASSWORD_INVALID');
  const value = await passwordVerify({ body: { password } }, sessionCommand(session, signal));
  return PasswordVerificationSchema.parse(value);
}

export async function bindCanonicalMobile(
  session: ConsoleSession,
  mainlandMobile: string,
  challenge: string,
  code: string,
  signal?: AbortSignal,
) {
  const value = await mobileManage(
    { body: { mobile: canonicalMainlandMobile(mainlandMobile), challenge, code } },
    sessionCommand(session, signal),
  );
  return MobileManageReceiptSchema.parse(value);
}

function command(
  context: ConsoleContext,
  session: ConsoleSession,
  expectedVersion: number,
  proof?: string,
  signal?: AbortSignal,
) {
  if (session.csrf === undefined) throw new Error('OWNER_TRANSFER_CSRF_MISSING');
  return consoleCommand(context.scope, {
    ...(signal === undefined ? {} : { signal }),
    accessVersion: session.accessVersion,
    expectedVersion,
    csrfToken: session.csrf,
    ...(proof === undefined ? {} : { proof }),
  });
}

function sessionCommand(session: ConsoleSession, signal?: AbortSignal) {
  return consoleCommand(undefined, {
    ...(signal === undefined ? {} : { signal }),
    accessVersion: session.accessVersion,
    ...(session.csrf === undefined ? {} : { csrfToken: session.csrf }),
  });
}

function canonicalMainlandMobile(value: string): string {
  if (!/^1[3-9][0-9]{9}$/.test(value)) throw new Error('OWNER_MOBILE_INVALID');
  return `+86${value}`;
}

function transferBody(configuration: TransferConfiguration) {
  return {
    targetMembership: configuration.targetMembership,
    formerOwnerMode: configuration.formerOwnerMode,
    ...(configuration.formerOwnerRole === undefined ? {} : { formerOwnerRole: configuration.formerOwnerRole }),
  };
}
