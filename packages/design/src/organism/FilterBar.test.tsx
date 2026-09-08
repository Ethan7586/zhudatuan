// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('connects fields and actions to the shared responsive style contract', () => {
    const { container } = render(
      <FilterBar label="商品筛选" actions={<button type="button">应用筛选</button>}>
        <label>商品名称<input /></label>
      </FilterBar>
    );

    expect(container.querySelector('.filterform')).toBeTruthy();
    expect(screen.getByRole('group', { name: '商品筛选操作' }).classList.contains('filterbaractions')).toBe(true);
  });
});
