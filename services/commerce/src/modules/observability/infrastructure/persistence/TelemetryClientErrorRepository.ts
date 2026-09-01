import type { Telemetry } from '@shop/telemetry';
import type { ClientErrorRepository } from '../../application/port/ClientErrorRepository';

export class TelemetryClientErrorRepository implements ClientErrorRepository {
  constructor(private readonly telemetry: Telemetry) {}
  record: ClientErrorRepository['record'] = (input) => this.telemetry.clientErrors.record(input);
  list: ClientErrorRepository['list'] = (scope, limit) => this.telemetry.clientErrors.list(scope, limit);
}
