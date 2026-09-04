import { describe, expect, it } from 'vitest';
import { automaticL6DisplayName, automaticRegistrationPassword } from './consumerRegistration';

describe('consumer quick registration', () => {
  it('creates an L6 display name without exposing the full mobile number', () => {
    expect(automaticL6DisplayName('+8613424327586')).toBe('L6消费者7586');
  });

  it('creates a strong opaque password for immediate storefront login', () => {
    const password = automaticRegistrationPassword();

    expect(password).toHaveLength(22);
    expect(password).toMatch(/^[A-Za-z].*[A-Za-z]$/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });
});
