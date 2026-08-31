import type { OperationOutputFor } from '@shop/contract';
import type { Home } from '../model/Home';

export function mapHome(value: OperationOutputFor<'storefront.bootstrap.read'> | undefined): Home | null {
  if (!value) return null;
  const data = value.experience.data as unknown;
  const pages = data && typeof data === 'object' && 'pages' in data && Array.isArray(data.pages) ? (data as { pages: readonly Readonly<{ id: string; path: string; blocks: readonly Record<string, unknown>[] }>[] }).pages : [];
  return Object.freeze({
    release: value.binding.release,
    version: value.experience.version,
    hash: value.binding.version,
    effectiveAt: value.experience.asOf,
    sections: Object.freeze(pages.map((page) => Object.freeze({ id: page.id, path: page.path, blocks: Object.freeze([...page.blocks]) }))),
  });
}
