import userEvent from '@testing-library/user-event';

export type BrowserUser = ReturnType<typeof userEvent.setup>;

export function createUser(): BrowserUser {
  return userEvent.setup();
}
