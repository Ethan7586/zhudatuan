import { randomBytes } from 'node:crypto';

export function localBootstrapPassword(): string {
  return `Aa1!${randomBytes(18).toString('base64url')}`;
}
