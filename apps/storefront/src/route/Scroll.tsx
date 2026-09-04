import { RouteScroll } from '@shop/design';
import { useLocation } from 'react-router';

export function Scroll() {
  const { key } = useLocation();
  return <RouteScroll entry={key} />;
}
