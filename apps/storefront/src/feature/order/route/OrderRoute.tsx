import { useSearchParams } from 'react-router';
import { useOrderViewModel } from '../viewmodel/OrderViewModel';
import { useInvoiceViewModel } from '../viewmodel/InvoiceViewModel';
import { OrderPage } from '../view/OrderPage';
import { InvoicePanel } from '../view/InvoicePanel';
export function Component() { const [search] = useSearchParams(); const orders = useOrderViewModel(); const invoices = useInvoiceViewModel(); return search.get('view') === 'invoices' ? <main className="sw-web-container mx-auto max-w-[1240px] p-4"><InvoicePanel viewmodel={invoices}/></main> : <OrderPage viewmodel={orders}/>; }
