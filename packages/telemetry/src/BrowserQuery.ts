import type { TelemetryWriter } from './Adapter';
import { BrowserRecorder } from './BrowserRecorder';

export interface BrowserQueryEvent {
  readonly resource: string;
  readonly durationms: number;
  readonly cache: 'hit' | 'miss' | 'stale';
  readonly outcome: 'ready' | 'empty' | 'denied' | 'failed';
  readonly aborted: boolean;
}

export class BrowserQuery extends BrowserRecorder<BrowserQueryEvent> {
  constructor(writer: TelemetryWriter) { super('query', writer); }
}
