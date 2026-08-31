import type { CatalogNavigationNode } from '../projection/NavigationFilter';

export class ReadNavigationCatalog {
  constructor(
    private readonly catalog: readonly CatalogNavigationNode[],
    private readonly hash: string
  ) {}
  execute() {
    const roots = this.catalog.filter((node) => node.parent === null).length;
    const parents = new Set(this.catalog.map((node) => node.id));
    const orphans = this.catalog.filter((node) => node.parent !== null && !parents.has(node.parent)).map((node) => node.id);
    const surfaces = Object.freeze({
      console: this.catalog.filter((node) => node.surface === 'console').length,
      storefront: this.catalog.filter((node) => node.surface === 'storefront').length,
    });
    return { status: 200, body: Object.freeze({ version: this.hash, hash: this.hash, nodes: this.catalog.length, roots, surfaces, orphans: Object.freeze(orphans) }), headers: { etag: `\"catalog-${this.hash}\"` } } as const;
  }
}
