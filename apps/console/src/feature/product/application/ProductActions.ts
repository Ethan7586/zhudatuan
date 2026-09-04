import type { Listing, ProductDraft } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export type ProductEdit =
  | Readonly<{ kind: 'create'; draft: ProductDraft }>
  | Readonly<{ kind: 'edit'; listing: Listing; title: string; category: string; status: string }>
  | Readonly<{ kind: 'archive' | 'publish' | 'unpublish'; listing: Listing }>
  | Readonly<{ kind: 'price'; listing: Listing; amountMinor: number }>;

export class ExecuteProductAction {
  constructor(private readonly port: ProductPort) {}
  execute(request: ProductCommand, action: ProductEdit) {
    if (action.kind === 'create') return this.port.createProduct(request, action.draft);
    if (action.kind === 'edit') return this.port.updateProduct(request, action.listing, { title: action.title, category: action.category, status: action.status });
    if (action.kind === 'archive') return this.port.archiveProduct(request, action.listing);
    if (action.kind === 'price') return this.port.publishPrice(request, action.listing, action.amountMinor);
    return this.port.changePublication(request, [action.listing], action.kind === 'publish');
  }
}
