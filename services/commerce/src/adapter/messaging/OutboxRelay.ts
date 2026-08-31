import type { DatabasePool } from '../../foundation/persistence/Pool';
import { Semaphore } from '../../foundation/performance/Semaphore';
import type { EventPublisher, OutboxMessage } from '../../foundation/messaging/Outbox';
import { PgOutbox } from '../database/PgOutbox';

export class OutboxRelay {
  private readonly semaphore: Semaphore;
  private readonly store: PgOutbox;
  constructor(
    pool: DatabasePool,
    private readonly publisher: EventPublisher,
    private readonly owner: string,
    concurrency = 8
  ) {
    this.semaphore = new Semaphore(concurrency);
    this.store = new PgOutbox(pool);
  }

  async relay(batch: number): Promise<number> {
    const events = await this.store.claim(this.owner, batch);
    await Promise.all(
      events.map((event) =>
        this.semaphore.use(async () => {
          try {
            await this.publisher.publish(event);
            await this.store.published(event, this.owner);
          } catch (cause) {
            await this.store.fail(event, this.owner, cause);
          }
        })
      )
    );
    return events.length;
  }

  async run(signal: AbortSignal, batch = 100, poll = 500): Promise<void> {
    while (!signal.aborted) {
      const count = await this.relay(batch);
      if (count === 0) await wait(poll, signal);
    }
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
