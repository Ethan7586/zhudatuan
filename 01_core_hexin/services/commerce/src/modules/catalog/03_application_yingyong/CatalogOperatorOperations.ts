import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { catalogImportOperations } from './CatalogImportOperations';
import { setListingBatchPublication, setListingPublication } from './CatalogListingPublication';

export const CATALOG_OPERATOR_OPERATION_IDS = Object.freeze([
  'catalog.imports.create',
  'catalog.imports.read',
  'catalog.listings.publish',
  'catalog.listings.unpublish',
  'catalog.listings.batch',
] as const satisfies readonly OperationId[]);

export function catalogOperatorOperations(context: ModuleContext): ModuleOperations {
  const imports = catalogImportOperations(context);
  const selected: OperationActions = {
    ...imports,
    'catalog.listings.publish': (request, database) => setListingPublication(request, database, 'published'),
    'catalog.listings.unpublish': (request, database) => setListingPublication(request, database, 'unpublished'),
    'catalog.listings.batch': setListingBatchPublication,
  };
  return new ModuleOperations(
    'catalog',
    context.container.get(DATABASE_POOL),
    context.container.get(AUDIT_SINK),
    selected,
    CATALOG_OPERATOR_OPERATION_IDS,
  );
}
