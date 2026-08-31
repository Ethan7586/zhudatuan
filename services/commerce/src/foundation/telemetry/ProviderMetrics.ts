import type { Telemetry, TelemetryContext } from '@shop/telemetry';

export class ProviderMetrics {
  constructor(private readonly telemetry: Telemetry) {}
  observe(provider: string, operation: string, context: TelemetryContext, milliseconds: number, result: 'success' | 'failure', errorCode?: string): void {
    const measured = { ...context, provider, operation, result, dependency: provider, dependencyDurationMs: milliseconds, ...(errorCode === undefined ? {} : { errorCode }) };
    this.telemetry.metrics.count('commerce.provider.count', 1, measured);
    this.telemetry.metrics.duration('commerce.provider.duration', milliseconds, measured);
  }
}
