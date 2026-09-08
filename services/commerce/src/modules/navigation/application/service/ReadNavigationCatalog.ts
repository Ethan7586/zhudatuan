import type { CatalogNavigationNode } from './NavigationFilter';
import { CLIENT_SURFACES, type ClientSurface } from '@shop/contract';

export class ReadNavigationCatalog {
  constructor(
    private readonly catalog: readonly CatalogNavigationNode[],
    private readonly hash: string
  ) {}
  execute() {
    const roots = this.catalog.filter((node) => node.parent === null).length;
    const parents = new Set(this.catalog.map((node) => node.key));
    const orphans = this.catalog.filter((node) => node.parent !== null && !parents.has(node.parent)).map((node) => node.key);
    const surfaces = Object.freeze(Object.fromEntries(CLIENT_SURFACES.map((surface) => [surface, this.catalog.filter((node) => node.surface === surface).length])) as Record<ClientSurface, number>);
    return { status: 200, body: Object.freeze({ version: this.hash, hash: this.hash, nodes: this.catalog.length, roots, surfaces, orphans: Object.freeze(orphans) }), headers: { etag: `\"catalog-${this.hash}\"` } } as const;
  }
}
