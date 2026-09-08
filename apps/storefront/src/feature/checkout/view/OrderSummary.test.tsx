// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutState } from '../application/CheckoutState';
import { OrderSummary } from './OrderSummary';

afterEach(cleanup);

describe('OrderSummary', () => {
  it('never invents a zero or estimated amount before the server quote exists', () => {
    const submit = vi.fn();
    render(<OrderSummary state={state('editing')} selectedCount={2} onSubmit={submit} />);
    expect(screen.queryByText('¥0.00')).toBeNull();
    expect(screen.getAllByText('服务端报价后显示')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /生成服务端报价/ }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it('does not expose a stale quote amount after selection changes', () => {
    render(<OrderSummary state={state('stale')} selectedCount={1} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/¥123\.45/)).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /重新报价/ }).disabled).toBe(false);
  });
});

function state(phase: 'editing' | 'stale'): CheckoutState {
  return Object.freeze({ phase, quote: null, canQuote: true, canCommit: false });
}
