import type { Logger } from './Logger';
import type { Metrics } from './Metrics';
import type { Tracer } from './Tracer';
import type { ClientErrorTelemetry } from './ClientErrors';

export interface Telemetry {
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly tracer: Tracer;
  readonly clientErrors: ClientErrorTelemetry;
}
