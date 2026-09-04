export class CartTokenStore {
  private memory: string | null = null;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private readonly key: string
  ) {}

  current(): string {
    const stored = this.existing();
    if (stored && /^[A-Za-z0-9_-]{43}$/.test(stored)) return stored;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    this.memory = token;
    try { this.storage.setItem(this.key, token); } catch { /* Private storage may be unavailable; memory still preserves this page session. */ }
    return token;
  }

  existing(): string | null {
    const stored = this.read();
    return stored && /^[A-Za-z0-9_-]{43}$/.test(stored) ? stored : null;
  }

  clear(): void {
    this.memory = null;
    try { this.storage.removeItem(this.key); } catch { /* Storage failure must not keep a consumed bearer in memory. */ }
  }

  private read(): string | null {
    if (this.memory) return this.memory;
    try { return this.storage.getItem(this.key); } catch { return null; }
  }
}
