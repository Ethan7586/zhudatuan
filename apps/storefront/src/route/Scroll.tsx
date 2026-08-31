import { useEffect } from 'react';
import { useLocation } from 'react-router';

export function Scroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}
