import type { TelemetryWriter } from './Adapter';
import { BrowserRecorder } from './BrowserRecorder';

export interface WebVitalEvent {
  readonly metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb';
  readonly value: number;
  readonly routeid: string;
  readonly rating: 'good' | 'needsimprovement' | 'poor';
}

export class WebVitals extends BrowserRecorder<WebVitalEvent> {
  constructor(writer: TelemetryWriter) { super('webvital', writer); }
}
