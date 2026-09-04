import { expect, it } from 'vitest';
import { catalogViewModel } from './CatalogViewModel';
it('binds the catalog route', () => expect(catalogViewModel.routes).toEqual(['miniappcatalog']));
