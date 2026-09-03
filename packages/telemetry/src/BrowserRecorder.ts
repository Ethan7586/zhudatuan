import type { TelemetryWriter } from './Adapter';
import { Redactor } from './Redactor';

export abstract class BrowserRecorder<TEvent extends object> {
  private readonly redactor = new Redactor();

  protected constructor(
    private readonly kind: string,
    private readonly writer: TelemetryWriter
  ) {}

  record(event: TEvent): void {
    const record = this.redactor.redact({ kind: 'browser', event: this.kind, ...event }) as Readonly<Record<string, unknown>>;
    void this.writer(Object.freeze(record));
  }
}
