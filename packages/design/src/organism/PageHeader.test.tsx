// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('uses the shared responsive header and action contracts', () => {
    const { container } = render(<PageHeader eyebrow="业务范围" title="商品治理台" description="维护商品。" actions={<button type="button">新建商品</button>} />);

    expect(container.querySelector('.pageheaderbody')).toBeTruthy();
    expect(screen.getByRole('group', { name: '商品治理台页面操作' }).classList.contains('pageheaderactions')).toBe(true);
  });
});
