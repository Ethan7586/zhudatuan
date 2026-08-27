import type { TelemetryContext } from './Context';

export interface Metrics {
  count(name: string, value: number, context: TelemetryContext): void;
  duration(name: string, milliseconds: number, context: TelemetryContext): void;
}
