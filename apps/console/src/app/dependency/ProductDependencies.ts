import type { ChangePool } from '../../feature/product/application/ChangePool';
import type { ChangePublication } from '../../feature/product/application/ChangePublication';
import type { ConfirmProductImport } from '../../feature/product/application/ConfirmProductImport';
import type { CreateProductImport } from '../../feature/product/application/CreateProductImport';
import type { ExecuteProductBatch } from '../../feature/product/application/ExecuteProductBatch';
import type { ExecuteProductAction } from '../../feature/product/application/ProductActions';
import type { PreviewProductBatch } from '../../feature/product/application/PreviewProductBatch';
import type { ReadProductImport } from '../../feature/product/application/ReadProductImport';
import type { ReadFacets } from '../../feature/product/application/ReadFacets';
import type { ReadPools } from '../../feature/product/application/ReadPools';
import type { ReadProduct } from '../../feature/product/application/ReadProduct';
import type { ReadProducts } from '../../feature/product/application/ReadProducts';
import type { ProductImportTemplate } from '../../feature/product/model/ProductImport';
import type { ProductImportPort, ProductPort } from '../../feature/product/public';
import type { PreferencePort } from '../../shared/preference/PreferencePort';

export interface ProductDependencies {
  readonly gateway: ProductPort & ProductImportPort;
  readonly readProducts: ReadProducts;
  readonly readProduct: ReadProduct;
  readonly readPools: ReadPools;
  readonly readFacets: ReadFacets;
  readonly changePublication: ChangePublication;
  readonly previewBatch: PreviewProductBatch;
  readonly executeBatch: ExecuteProductBatch;
  readonly changePool: ChangePool;
  readonly executeAction: ExecuteProductAction;
  readonly createImport: CreateProductImport;
  readonly readImport: ReadProductImport;
  readonly confirmImport: ConfirmProductImport;
  readonly importTemplate: ProductImportTemplate;
  readonly preferences: PreferencePort;
  readonly createIdentity: () => string;
}
