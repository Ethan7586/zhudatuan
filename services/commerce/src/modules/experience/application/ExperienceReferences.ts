import type { ExperienceDocument } from '@shop/contract';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { ExperienceCatalogPort } from '../../catalog/public';
import type { ExperienceMarketingPort } from '../../marketing/public';

export class ExperienceReferences {
  constructor(
    private readonly catalog: ExperienceCatalogPort,
    private readonly marketing: ExperienceMarketingPort
  ) {}

  async valid(database: OperationDatabase, document: ExperienceDocument, pool: string): Promise<boolean> {
    const references = collect(document);
    const pages = new Set(document.pages.flatMap((page) => [page.id, page.path]));
    if (references.micropages.some((target) => !pages.has(target))) return false;
    const [catalog, marketing] = await Promise.all([
      this.catalog.references(database, pool, {
        products: references.products,
        categories: references.categories,
        collections: references.collections,
      }),
      this.marketing.references(database, references.campaigns),
    ]);
    return catalog && marketing;
  }
}

function collect(document: ExperienceDocument) {
  const values = new Map<string, Set<string>>();
  for (const page of document.pages)
    for (const block of page.blocks)
      if (block.action) {
        const targets = values.get(block.action.type) ?? new Set<string>();
        targets.add(block.action.target);
        values.set(block.action.type, targets);
      }
  const list = (kind: string) => Object.freeze([...(values.get(kind) ?? [])].sort());
  return Object.freeze({
    products: Object.freeze([...new Set([...list('product'), ...list('exchangeableproduct')])].sort()),
    categories: list('category'),
    collections: list('collection'),
    campaigns: list('marketingactivity'),
    micropages: list('micropage'),
  });
}
