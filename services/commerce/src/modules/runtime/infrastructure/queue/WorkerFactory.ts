import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { OutboxRelay } from '../../../../platform/messaging/OutboxRelay';
import { RuntimeEventPublisher } from '../../../../platform/messaging/RuntimeEventPublisher';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleWorker } from '../../../../pipeline/ModuleWorker';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { RuntimeScheduler } from './RuntimeScheduler';

export function createWorkers(context: ModuleContext): readonly ModuleWorker[] {
  const pool = context.service(DATABASE_POOL);
  const worker = context.worker;
  const handlers = context.events.handlers;
  if (!worker || !handlers) throw new Error('RUNTIME_WORKER_CONTEXT_INVALID');
  const outbox = new OutboxRelay(pool, new RuntimeEventPublisher(pool, { handlers }), worker, RUNTIME_LIMITS.worker.outbox.concurrency);
  const scheduler = new RuntimeScheduler(pool, worker, RUNTIME_LIMITS.worker.scheduler);
  return Object.freeze([
    { id: 'outboxrelay', worker: { run: (signal: AbortSignal) => outbox.run(signal, RUNTIME_LIMITS.worker.outbox.batch, RUNTIME_LIMITS.worker.outbox.pollMilliseconds) } },
    { id: 'scheduler', worker: scheduler },
  ]);
}
