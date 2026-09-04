import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const invoiceManifest = defineSupplierFeature('invoice', [{ routeid: 'supplierinvoice', title: '发票协同', breadcrumbs: ['供应链后台', '发票协同'], load: () => import('../route/InvoiceRoute') }]);
