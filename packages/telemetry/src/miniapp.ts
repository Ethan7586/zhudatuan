import { createTelemetry, type TelemetryWriter } from './Adapter';

export function miniappTelemetry(writer: TelemetryWriter) { return createTelemetry(writer); }
