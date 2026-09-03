import type { TelemetryWriter } from './Adapter';
import { BrowserRecorder } from './BrowserRecorder';

export interface BrowserMutationEvent {
  readonly operation: string;
  readonly durationms: number;
  readonly outcome: 'success' | 'failed' | 'expired';
  readonly conflict: boolean;
  readonly stepup: boolean;
}

export class BrowserMutation extends BrowserRecorder<BrowserMutationEvent> {
  constructor(writer: TelemetryWriter) { super('mutation', writer); }
}
