export class EventRegistry {
  private readonly subscribers = new Map<string, Set<string>>();
  private frozen = false;

  register(event: string, subscribers: readonly string[]): void {
    if (this.frozen) throw new Error('EVENT_REGISTRY_FROZEN');
    if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){1,}$/.test(event) || subscribers.some((subscriber) => !/^[a-z][a-z0-9]*$/.test(subscriber))) {
      throw new Error(`EVENT_SUBSCRIBER_INVALID:${event}`);
    }
    if (this.subscribers.has(event)) throw new Error(`EVENT_SUBSCRIBER_DUPLICATE:${event}`);
    if (new Set(subscribers).size !== subscribers.length) throw new Error(`EVENT_SUBSCRIBER_DUPLICATE:${event}`);
    this.subscribers.set(event, new Set(subscribers));
  }

  freeze(): void {
    this.frozen = true;
    for (const subscribers of this.subscribers.values()) Object.freeze(subscribers);
  }

  handlers(event: string): readonly string[] {
    if (!this.frozen) throw new Error('EVENT_REGISTRY_NOT_FROZEN');
    const handlers = this.subscribers.get(event);
    if (!handlers) throw new Error(`EVENT_HANDLER_CATALOG_MISSING:${event}`);
    return Object.freeze([...handlers]);
  }

  catalog(): readonly Readonly<{ event: string; subscribers: readonly string[] }>[] {
    if (!this.frozen) throw new Error('EVENT_REGISTRY_NOT_FROZEN');
    return Object.freeze([...this.subscribers].sort(([left], [right]) => left.localeCompare(right)).map(([event, subscribers]) => Object.freeze({ event, subscribers: Object.freeze([...subscribers]) })));
  }
}
