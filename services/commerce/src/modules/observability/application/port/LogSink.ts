import { token } from '../../../../composition/Container';
import type { LogSink } from '../../public/TelemetryPort';
export type { LogEntry, LogSink } from '../../public/TelemetryPort';

export const LOG_SINK = token<LogSink>('observability.log');
