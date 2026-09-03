import type { TelemetryWriter } from './Adapter';
import { BrowserRecorder } from './BrowserRecorder';

export interface BrowserNavigationEvent {
  readonly routeid: string;
  readonly durationms: number;
  readonly outcome: 'ready' | 'denied' | 'failed';
}

export class BrowserNavigation extends BrowserRecorder<BrowserNavigationEvent> {
  constructor(writer: TelemetryWriter) { super('navigation', writer); }
}
