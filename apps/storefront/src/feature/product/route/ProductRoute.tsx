import { useParams } from 'react-router';
import { useProductViewModel } from '../viewmodel/ProductViewModel';
import { ProductPage } from '../view/ProductPage';
export function Component() { const { productId = '' } = useParams(); return <ProductPage viewmodel={useProductViewModel(productId)} />; }
