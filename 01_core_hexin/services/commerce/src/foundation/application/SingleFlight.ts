export class SingleFlight<Value> {
  private readonly active = new Map<string, Promise<Value>>();

  run(key: string, load: () => Promise<Value>): Promise<Value> {
    const current = this.active.get(key);
    if (current) return current;
    const pending = Promise.resolve().then(load).finally(() => {
      if (this.active.get(key) === pending) this.active.delete(key);
    });
    this.active.set(key, pending);
    return pending;
  }
}
