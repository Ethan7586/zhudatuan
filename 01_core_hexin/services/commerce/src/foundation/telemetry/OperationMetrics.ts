import type { Telemetry, TelemetryContext } from '@shop/telemetry';

export class OperationMetrics {
  constructor(private readonly telemetry: Telemetry) {}

  observe(context: TelemetryContext, status: number, milliseconds: number, errorCode?: string): void {
    const result = status < 400 ? 'success' : 'failure';
    const measured = { ...context, result, durationMs: milliseconds, ...(errorCode === undefined ? {} : { errorCode }) };
    this.telemetry.metrics.count('commerce.operation.count', 1, measured);
    this.telemetry.metrics.duration('commerce.operation.duration', milliseconds, measured);
  }
}
