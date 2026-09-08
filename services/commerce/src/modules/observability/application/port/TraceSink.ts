import { token } from '../../../../composition/Container';
import type { TraceSink } from '../../public/TelemetryPort';
export type { TraceHandle, TraceSink } from '../../public/TelemetryPort';

export const TRACE_SINK = token<TraceSink>('observability.trace');
