export class EventHarness<T extends { readonly type: string }> {
  readonly events: T[] = [];

  publish(event: T): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  ofType(type: T['type']): readonly T[] {
    return this.events.filter((event) => event.type === type);
  }
}
