import { useInvoiceViewModel } from '../viewmodel/InvoiceViewModel';
import { SectionRoute } from './SectionRoute';
export function Component() { return <SectionRoute title="发票" useModel={useInvoiceViewModel} />; }
