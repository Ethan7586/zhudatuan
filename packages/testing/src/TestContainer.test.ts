import { describe, expect, it } from 'vitest';
import { createTestToken, TestContainer } from './TestContainer';

describe('TestContainer', () => {
  it('binds and resolves values through typed tokens', () => {
    const count = createTestToken<number>('count');
    const container = new TestContainer().bind(count, 3);
    expect(container.has(count)).toBe(true);
    expect(container.get(count)).toBe(3);
  });

  it('rejects missing and duplicate bindings', () => {
    const name = createTestToken<string>('name');
    const container = new TestContainer();
    expect(() => container.get(name)).toThrow('TEST_BINDING_MISSING:name');
    container.bind(name, '智慧翼');
    expect(() => container.bind(name, '重复')).toThrow('TEST_BINDING_DUPLICATE:name');
  });
});
