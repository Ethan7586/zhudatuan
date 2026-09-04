// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceButton } from './ChoiceButton';

describe('ChoiceButton', () => {
  it.each([
    { kind: 'tab' as const, state: 'aria-selected' },
    { kind: 'radio' as const, state: 'aria-checked' },
  ])('preserves $kind semantics and roving focus', ({ kind, state }) => {
    const choose = vi.fn();
    render(<ChoiceButton kind={kind} selected onChoose={choose}>选项</ChoiceButton>);

    const choice = screen.getByRole(kind, { name: '选项' });
    expect(choice.getAttribute(state)).toBe('true');
    expect(choice.tabIndex).toBe(0);
    fireEvent.click(choice);
    expect(choose).toHaveBeenCalledOnce();
  });

  it('removes an unselected choice from the sequential tab order', () => {
    render(<ChoiceButton kind="radio" selected={false} onChoose={vi.fn()}>备选项</ChoiceButton>);
    expect(screen.getByRole('radio', { name: '备选项' }).tabIndex).toBe(-1);
  });
});
