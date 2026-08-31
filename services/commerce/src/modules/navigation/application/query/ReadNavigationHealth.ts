import type { NavigationCache, NavigationInvalidationState } from '../port/NavigationCache';

export class ReadNavigationHealth {
  constructor(
    private readonly cache: NavigationCache,
    private readonly invalidator: NavigationInvalidationState,
    private readonly catalogHash: string,
    private readonly nodeCount: number
  ) {}
  execute() {
    const state = this.cache.state();
    return {
      status: 200,
      body: Object.freeze({
        status: state.available ? 'healthy' : 'degraded',
        catalogHash: this.catalogHash,
        catalogReadable: this.nodeCount > 0,
        nodes: this.nodeCount,
        cache: state.available ? 'available' : 'degraded',
        cacheReason: state.reason ?? null,
        lastEventAt: this.invalidator.lastEventAt(),
      }),
    } as const;
  }
}
