import type { TelemetryContext } from './Context';
import { Redactor } from './Redactor';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord extends TelemetryContext {
  readonly level: LogLevel;
  readonly event: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface LogSink {
  write(record: Readonly<Record<string, unknown>>): void | Promise<void>;
}

export class Logger {
  constructor(private readonly sink: LogSink, private readonly redactor = new Redactor()) {}

  write(record: LogRecord): void | Promise<void> {
    return this.sink.write(Object.freeze(this.redactor.redact(record) as Readonly<Record<string, unknown>>));
  }
}
