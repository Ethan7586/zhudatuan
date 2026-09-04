// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoritePanel } from './FavoritePanel';

afterEach(cleanup);

describe('FavoritePanel', () => {
  it('explains an unavailable favorite, prevents a broken detail jump and keeps removal actionable', () => {
    const open = vi.fn();
    const remove = vi.fn();
    render(
      <FavoritePanel favorites={[{ listingId: 'listing:one', createdAt: '2026-09-04T00:00:00.000Z', version: 2, available: false, unavailableReason: '商品已下架，可取消收藏' }]} products={[]} open={open} remove={remove} back={vi.fn()} />
    );

    expect(screen.getByText('商品已下架，可取消收藏')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /已收藏商品/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '取消收藏' }));
    expect(remove).toHaveBeenCalledWith('listing:one');
    expect(open).not.toHaveBeenCalled();
  });
});
