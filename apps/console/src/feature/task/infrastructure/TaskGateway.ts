import { createFetchCatalog, type CatalogOperations } from '@shop/sdk/catalog';
import { createFetchMember, type MemberOperations } from '@shop/sdk/member';
import { createFetchVoucher, type VoucherOperations } from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/RequestContext';
import type { ImportKind } from '../model/ImportTask';
import type { TaskPort } from '../public';
import { TaskMapper } from './TaskMapper';

export class TaskGateway implements TaskPort {
  private readonly member: MemberOperations;
  private readonly catalog: CatalogOperations;
  private readonly voucher: VoucherOperations;
  private readonly mapper = new TaskMapper();
  constructor(baseUrl: string) {
    this.member = createFetchMember(baseUrl);
    this.catalog = createFetchCatalog(baseUrl);
    this.voucher = createFetchVoucher(baseUrl);
  }
  async read(context: ConsoleContext, kind: ImportKind, id: string, signal?: AbortSignal) {
    const input = { path: { importid: id } };
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const value = kind === 'member' ? await this.member.importsRead(input, request) : kind === 'catalog' ? await this.catalog.importsRead(input, request) : await this.voucher.importsRead(input, request);
    return this.mapper.task(kind, value);
  }
}
