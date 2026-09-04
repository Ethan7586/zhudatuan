import type { AuthTarget } from '@shop/config/client';
import type { LinkSnapshot } from '../model/Link';
export interface LinkPort {
  read(target: AuthTarget, signal: AbortSignal): Promise<LinkSnapshot>;
}
