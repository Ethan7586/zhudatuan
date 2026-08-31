import { createFetchCatalogImportsRead } from '@shop/sdk/catalog';
import { createFetchMemberImportsRead } from '@shop/sdk/member';
import { createFetchVoucherImportsRead } from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import { ImportJobSchema, type ImportKind } from './ImportSchema';

const memberImportsRead = createFetchMemberImportsRead(appConfig.apiBaseUrl);
const catalogImportsRead = createFetchCatalogImportsRead(appConfig.apiBaseUrl);
const voucherImportsRead = createFetchVoucherImportsRead(appConfig.apiBaseUrl);

export const importKinds = ['member', 'catalog', 'voucher'] as const;
export const importKey = (context: ConsoleContext, kind: ImportKind, jobId: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, `${kind}.imports.read`, jobId] as const);
export async function readImport(context: ConsoleContext, kind: ImportKind, jobId: string, signal: AbortSignal) {
  const input = { path: { importid: jobId } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  const value = kind === 'member' ? await memberImportsRead(input, request) : kind === 'catalog' ? await catalogImportsRead(input, request) : await voucherImportsRead(input, request);
  return ImportJobSchema.parse(value);
}
