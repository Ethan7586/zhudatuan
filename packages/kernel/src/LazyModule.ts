export class LazyModule<T> {
  private pending: Promise<T> | undefined;

  constructor(private readonly loader: () => Promise<T>) {}

  load(): Promise<T> {
    if (this.pending !== undefined) return this.pending;
    let pending!: Promise<T>;
    pending = this.loader().catch((cause: unknown) => {
      if (this.pending === pending) this.pending = undefined;
      throw cause;
    });
    this.pending = pending;
    return pending;
  }

  preload(): void {
    void this.load().catch(() => undefined);
  }
}
