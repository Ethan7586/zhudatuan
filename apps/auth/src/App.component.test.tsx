import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import App from './app/App';
import { AuthProvider } from './app/AuthProvider';

describe('authentication application boundary', () => {
  it('mounts the router inside the single authentication provider', () => {
    const result = App();
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement(result)) throw new Error('AUTH_APP_ELEMENT_REQUIRED');
    expect(result.type).toBe(AuthProvider);
  });
});
