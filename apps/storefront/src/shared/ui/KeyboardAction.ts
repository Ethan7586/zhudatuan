import type { KeyboardEvent } from 'react';

export function keyboardAction(event: KeyboardEvent<HTMLElement>, action: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
}
