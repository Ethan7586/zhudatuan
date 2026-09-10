import { expect, it } from 'vitest';
import { reconciliationViewModel } from './ReconciliationViewModel';
it('binds reconciliation', () => expect(reconciliationViewModel.routes).toEqual(['supplierreconciliation']));
