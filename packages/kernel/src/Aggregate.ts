import type { DomainEvent } from './DomainEvent';
import { Entity } from './Entity';

export abstract class Aggregate<TId extends string = string> extends Entity<TId> {
  private pending: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.pending.push(event);
  }

  pullEvents(): readonly DomainEvent[] {
    const events = Object.freeze([...this.pending]);
    this.pending = [];
    return events;
  }
}
