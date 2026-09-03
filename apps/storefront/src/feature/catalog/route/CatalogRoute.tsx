import { useCatalogViewModel } from '../viewmodel/CatalogViewModel';
import { CatalogPage } from '../view/CatalogPage';
export function Component() { return <CatalogPage viewmodel={useCatalogViewModel()} />; }
