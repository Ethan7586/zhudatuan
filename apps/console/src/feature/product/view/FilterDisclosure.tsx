import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { useMediaQuery } from '../../../shared/view/useMediaQuery';

const desktopQuery = '(min-width: 1024px)';

export function FilterDisclosure({ count, children }: Readonly<{ count: number; children: ReactNode }>) {
  const wide = useMediaQuery(desktopQuery, true);
  const [expanded, setExpanded] = useState(false);
  const open = wide || expanded;
  const toggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (!wide) setExpanded(event.currentTarget.open);
  };
  return (
    <details className="productfilterdisclosure" open={open} onToggle={toggle}>
      <summary>
        <span>筛选商品</span>
        <small>{count === 0 ? '未启用筛选' : `已启用 ${count} 个条件`}</small>
      </summary>
      {children}
    </details>
  );
}
