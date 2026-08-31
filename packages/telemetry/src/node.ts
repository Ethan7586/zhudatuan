import { createTelemetry, type TelemetryWriter } from './Adapter';

export function nodeTelemetry(writer: TelemetryWriter) {
  return createTelemetry(writer);
}
