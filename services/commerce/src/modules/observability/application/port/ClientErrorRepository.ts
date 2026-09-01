import type { ClientErrorInput, ClientErrorRecord, TelemetryScope } from '@shop/telemetry';

export interface ClientErrorRepository {
  record(input: ClientErrorInput): ClientErrorRecord;
  list(scope: TelemetryScope, limit: number): readonly ClientErrorRecord[];
}
