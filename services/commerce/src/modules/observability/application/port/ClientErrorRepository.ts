import type { ClientErrorInput, ClientErrorRecord, TelemetryScope } from '@shop/telemetry';

export interface ClientErrorRepository {
  sanitize(input: ClientErrorInput): ClientErrorInput;
  record(input: ClientErrorInput): ClientErrorRecord;
  list(scope: TelemetryScope, limit: number): readonly ClientErrorRecord[];
}
