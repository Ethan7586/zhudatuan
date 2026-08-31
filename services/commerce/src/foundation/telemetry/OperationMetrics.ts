import type { Telemetry, TelemetryContext } from '@shop/telemetry';
import { failureLog } from './FailureLog';

export class OperationMetrics {
  constructor(private readonly telemetry: Telemetry) {}

  failure(context: TelemetryContext, cause: unknown): void {
    void this.telemetry.logger.write({
      ...context,
      level: 'error',
      event: 'commerce.operation.failure',
      data: failureLog(cause),
    });
  }

  cancelled(context: TelemetryContext, milliseconds: number): void {
    const measured = { ...context, result: 'cancelled', durationMs: milliseconds };
    this.telemetry.metrics.count('commerce.operation.count', 1, measured);
    this.telemetry.metrics.duration('commerce.operation.duration', milliseconds, measured);
  }

  observe(context: TelemetryContext, status: number, milliseconds: number, errorCode?: string): void {
    const result = status < 400 ? 'success' : 'failure';
    const measured = { ...context, result, durationMs: milliseconds, ...(errorCode === undefined ? {} : { errorCode }) };
    this.telemetry.metrics.count('commerce.operation.count', 1, measured);
    this.telemetry.metrics.duration('commerce.operation.duration', milliseconds, measured);
  }
}
