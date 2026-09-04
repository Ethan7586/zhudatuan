import { useState } from 'react';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing } from '../model/Product';
import type { ProductDrawerTab } from '../view/ProductDrawerPanels';
import { useProductDetailViewModel } from './ProductDetailViewModel';

export function useProductDrawerViewModel(listing: Listing | undefined, context: ConsoleContext, dependencies: ProductDependencies) {
  const [tab, selectTab] = useState<ProductDrawerTab>('overview');
  const viewmodel = useProductDetailViewModel(listing?.product_id ?? '', context, dependencies);
  const core = viewmodel.sections.core.data;
  const detail = core === undefined ? undefined : Object.freeze({
    ...core,
    prices: viewmodel.sections.pricing.data?.prices ?? Object.freeze([]),
    inventory: viewmodel.sections.inventory.data?.inventory ?? Object.freeze([]),
    qualifications: viewmodel.sections.qualification.data?.qualifications ?? Object.freeze([]),
  });
  return Object.freeze({ listing, tab, selectTab, detail, sections: viewmodel.sections });
}
