export class PendingAction {
  private current: (() => Promise<void>) | null = null;

  schedule(action: () => Promise<void>): void {
    this.current = action;
  }

  clear(): void {
    this.current = null;
  }

  resume(): void {
    const action = this.current;
    this.current = null;
    if (action) void action();
  }
}
