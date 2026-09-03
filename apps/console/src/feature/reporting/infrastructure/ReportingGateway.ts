import { createFetchReporting } from '@shop/sdk/reporting';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/Client';
import type { ReportFilter } from '../model/Report';
import type { ReportingPort } from '../public';
import { ReportingMapper } from './ReportingMapper';

export class ReportingGateway implements ReportingPort {
  private readonly client;

  constructor(baseUrl: string, private readonly mapper = new ReportingMapper()) {
    this.client = createFetchReporting(baseUrl);
  }

  async read(context: ConsoleContext, filter: ReportFilter, signal?: AbortSignal) {
    const input = { query: { limit: 50, period: filter.period, ...(filter.application ? { applicationid: filter.application } : {}), ...(filter.cursor ? { cursor: filter.cursor } : {}) } };
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    if (filter.view === 'sales') return this.mapper.page(await this.client.salesRead(input, request));
    if (filter.view === 'products') return this.mapper.page(await this.client.productsRead(input, request));
    if (filter.view === 'malls') return this.mapper.page(await this.client.mallsRead(input, request));
    if (filter.view === 'categories') return this.mapper.page(await this.client.categoriesRead(input, request));
    if (filter.view === 'channels') return this.mapper.page(await this.client.channelsRead(input, request));
    return this.mapper.page(await this.client.voucherconsumptionRead(input, request));
  }

  async createExport(context: ConsoleContext, filter: ReportFilter, identity: string, signal?: AbortSignal) {
    const request = consoleCommand(context.scope, { accessVersion: context.session.accessVersion, idempotencyKey: identity, ...(context.session.csrf ? { csrfToken: context.session.csrf } : {}), ...(signal ? { signal } : {}) });
    return this.mapper.export(await this.client.exportsCreate({ body: { report: 'metrics', filter: { view: filter.view, period: filter.period, ...(filter.application ? { application: filter.application } : {}) } } }, request));
  }

  async readExport(context: ConsoleContext, id: string, signal?: AbortSignal) {
    return this.mapper.export(await this.client.exportsRead({ path: { exportid: id } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }
}
