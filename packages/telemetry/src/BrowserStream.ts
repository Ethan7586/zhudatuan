import type { TelemetryWriter } from './Adapter';
import { BrowserRecorder } from './BrowserRecorder';

export interface BrowserStreamEvent {
  readonly channel: string;
  readonly reconnects: number;
  readonly cursorage: number;
  readonly outcome: 'connected' | 'recovering' | 'failed';
}

export class BrowserStream extends BrowserRecorder<BrowserStreamEvent> {
  constructor(writer: TelemetryWriter) { super('stream', writer); }
}
