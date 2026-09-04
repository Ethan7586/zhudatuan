import type { NavigationPort } from './NavigationPort';

export class BrowserNavigation implements NavigationPort {
  constructor(private readonly allowedOrigins: readonly string[]) {}

  assign(target: string): void {
    window.location.assign(this.authorize(target));
  }
  assignExternal(target: string): void {
    const value = new URL(target);
    if (value.protocol !== 'https:' || value.username || value.password || value.hash) throw new Error('NAVIGATION_ORIGIN_DENIED');
    window.location.assign(value.toString());
  }
  replace(target: string): void {
    window.location.replace(this.authorize(target));
  }
  reload(): void {
    window.location.reload();
  }

  private authorize(target: string): string {
    const value = new URL(target, window.location.origin);
    if (value.protocol !== 'https:' && value.hostname !== '127.0.0.1' && value.hostname !== 'localhost') throw new Error('NAVIGATION_PROTOCOL_DENIED');
    if (value.origin !== window.location.origin && !this.allowedOrigins.includes(value.origin)) throw new Error('NAVIGATION_ORIGIN_DENIED');
    return value.toString();
  }
}
