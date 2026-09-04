import type { Telemetry, TelemetryContext } from '@shop/telemetry';

export class DependencyMetrics {
  constructor(private readonly telemetry: Telemetry) {}
  async measure<T>(dependency: string, context: TelemetryContext, action: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      const result = await action();
      this.observe(dependency, context, performance.now()-started, 'success');
      return result;
    } catch (cause) {
      this.observe(dependency, context, performance.now()-started, 'failure', cause instanceof Error ? cause.message : 'DEPENDENCY_FAILED');
      throw cause;
    }
  }
  private observe(dependency: string, context: TelemetryContext, duration: number, result: string, errorCode?: string): void {
    const measured = { ...context, dependency, dependencyDurationMs: duration, result, ...(errorCode === undefined ? {} : { errorCode }) };
    this.telemetry.metrics.duration('commerce.dependency.duration', duration, measured);
  }
}
