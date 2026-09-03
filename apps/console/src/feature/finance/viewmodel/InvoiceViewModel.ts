import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useInvoiceViewModel(context: ConsoleContext, dependencies: FinanceDependencies) { return useSectionViewModel(context, dependencies, 'invoices'); }
export type InvoiceViewModel = ReturnType<typeof useInvoiceViewModel>;
