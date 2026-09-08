import { token } from '../../composition/Container';

export interface StreamEntry {
  readonly id: string;
  readonly stream: string;
  readonly value: string;
}

export interface EventStream {
  start(): Promise<void>;
  append(stream: string, value: string): Promise<string>;
  validate(streams: readonly string[], cursor: string | null): Promise<void>;
  read(streams: readonly string[], cursor: string | null, signal: AbortSignal): AsyncIterable<StreamEntry>;
  close(): Promise<void>;
}

export const EVENT_STREAM = token<EventStream>('event.stream');
