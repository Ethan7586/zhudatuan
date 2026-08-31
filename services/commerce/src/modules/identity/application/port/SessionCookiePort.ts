import type { AuthTarget } from '@shop/config/server';

export interface SessionCookiePort {
  session(target: AuthTarget, token: string, csrf: string, maxAge: number): Readonly<Record<string, string>>;
  read(value: string | undefined, name: string): string | undefined;
  preauth(token: string, maxAge?: number): string;
}
