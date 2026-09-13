import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SupplyLoadingState } from './SupplyChainRoute';

afterEach(cleanup);

describe('SupplyChainRoute loading feedback', () => {
  it('shows an immediate readable loading state instead of an empty workspace', () => {
    render(<SupplyLoadingState slow={false} />);

    expect(screen.getByRole('status').textContent).toContain('正在读取供应链数据');
    expect(screen.getByText('正在汇总供货伙伴、商品、价格和库存。')).toBeTruthy();
  });

  it('explains that a slow read is still progressing', () => {
    render(<SupplyLoadingState slow />);

    expect(screen.getByRole('status').textContent).toContain('供应数据较多，仍在读取');
    expect(screen.getByText('页面没有卡死，供货伙伴和库存汇总完成后会自动显示。')).toBeTruthy();
  });
});
