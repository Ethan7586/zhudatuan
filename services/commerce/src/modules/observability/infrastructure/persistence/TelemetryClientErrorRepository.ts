import { ROUTE_CATALOG } from '@shop/config/route';
import { OperationCatalog } from '@shop/contract';
import { Redactor, type ClientErrorInput, type Telemetry } from '@shop/telemetry';
import type { ClientErrorRepository } from '../../application/port/ClientErrorRepository';

export class TelemetryClientErrorRepository implements ClientErrorRepository {
  private readonly redactor = new Redactor();
  constructor(private readonly telemetry: Telemetry) {}
  sanitize: ClientErrorRepository['sanitize'] = (input) => this.safe(input);
  record: ClientErrorRepository['record'] = (input) => this.telemetry.clientErrors.record(this.safe(input));
  list: ClientErrorRepository['list'] = (scope, limit) => this.telemetry.clientErrors.list(scope, limit);

  private safe(input: ClientErrorInput): ClientErrorInput {
    if (!routes.has(`${input.surface}:${input.route}`)) throw new Error('CLIENT_ERROR_ROUTE_INVALID');
    if (input.operation !== null && !operations.has(input.operation)) throw new Error('CLIENT_ERROR_OPERATION_INVALID');
    if (!releasePattern.test(input.release)) throw new Error('CLIENT_ERROR_RELEASE_INVALID');
    return Object.freeze(this.redactor.redact(input) as ClientErrorInput);
  }
}

const routes = new Set(ROUTE_CATALOG.map(({ surface, id }) => `${surface}:${id}`));
const operations = new Set<string>(OperationCatalog.all().map(({ id }) => id));
const releasePattern = /^[a-z0-9][a-z0-9.:/-]{0,119}$/;
