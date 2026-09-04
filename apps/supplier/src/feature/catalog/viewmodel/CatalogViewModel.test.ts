import { expect, it } from 'vitest'; import { catalogViewModel } from './CatalogViewModel';
it('binds catalog', () => expect(catalogViewModel.routes).toEqual(['suppliercatalog']));
