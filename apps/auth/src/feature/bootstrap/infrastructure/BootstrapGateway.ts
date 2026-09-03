import type { AuthTarget } from '@shop/config/client';
import { ClientError } from '@shop/sdk';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { queryContext } from '../../../shared/api/Context';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { Bootstrap } from '../model/Bootstrap';
import type { BootstrapPort } from '../public/BootstrapPort';
import { mapBootstrap } from './BootstrapMapper';

const MAXIMUM_CACHE_MILLISECONDS = 10 * 60 * 1000;

export class BootstrapGateway implements BootstrapPort {
  private readonly cache = new Map<string, Bootstrap>();
  private readonly pending = new Map<string, Promise<Bootstrap>>();

  constructor(private readonly sdk: IdentitySdk, private readonly environment: AuthEnvironment) {}

  read(target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal): Promise<Bootstrap> {
    const key = `${target}:${returns.returnTarget ?? ''}:${returns.returnPath ?? ''}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return consume(Promise.resolve(cached), signal);
    const active = this.pending.get(key);
    if (active) return consume(active, signal);
    const input = returns.returnTarget ? { query: { returntarget: returns.returnTarget } } : returns.returnPath ? { query: { returnpath: returns.returnPath } } : {};
    const operation = this.sdk.bootstrapRead(input, queryContext(this.environment, target))
      .then(mapBootstrap)
      .then((value) => {
        if (value.target !== target) throw new ClientError('RETURN_TARGET_INVALID');
        const expiresAt = Math.min(value.expiresAt, Date.now() + MAXIMUM_CACHE_MILLISECONDS);
        const cachedValue = Object.freeze({ ...value, expiresAt });
        this.cache.set(key, cachedValue);
        return cachedValue;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, operation);
    return consume(operation, signal);
  }

  clear(target?: AuthTarget): void {
    for (const [key] of this.cache) if (!target || key.startsWith(`${target}:`)) this.cache.delete(key);
  }
}

function consume<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    void operation.then(
      (value) => { signal.removeEventListener('abort', abort); resolve(value); },
      (cause: unknown) => { signal.removeEventListener('abort', abort); reject(cause); }
    );
  });
}
