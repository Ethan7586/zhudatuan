import type { ReactNode } from 'react';
import { ResponsiveDisclosure } from '../../../shared/view/ResponsiveDisclosure';

export function FilterDisclosure({ count, children }: Readonly<{ count: number; children: ReactNode }>) {
  return (
    <ResponsiveDisclosure
      className="productfilterdisclosure"
      summary={
        <>
          <span>筛选商品</span>
          <small>{count === 0 ? '未启用筛选' : `已启用 ${count} 个条件`}</small>
        </>
      }
    >
      {children}
    </ResponsiveDisclosure>
  );
}
