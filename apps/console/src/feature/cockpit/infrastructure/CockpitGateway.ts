import { createFetchReportingDashboardRead } from '@shop/sdk/reporting';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/RequestContext';
import type { CockpitFilter } from '../model/Cockpit';
import type { CockpitPort } from '../public';
import { CockpitMapper } from './CockpitMapper';

export class CockpitGateway implements CockpitPort {
  private readonly readDashboard;
  constructor(
    baseUrl: string,
    private readonly mapper = new CockpitMapper()
  ) {
    this.readDashboard = createFetchReportingDashboardRead(baseUrl);
  }
  async read(context: ConsoleContext, filter: CockpitFilter, signal?: AbortSignal) {
    const value = await this.readDashboard({ query: { period: filter.period, limit: 100, ...(filter.application ? { applicationid: filter.application } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.map(value);
  }
}
