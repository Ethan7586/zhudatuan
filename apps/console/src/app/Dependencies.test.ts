import { describe, expect, it } from 'vitest';
import { createConsoleDependencies } from './Dependencies';
import { consoleRegistries } from './registry/Registries';

describe('console dependency composition', () => {
  it('injects the generated registries into their owning modules', () => {
    const dependencies = createConsoleDependencies();

    expect(dependencies.approval.registry).toBe(consoleRegistries.approval);
    expect(dependencies.task.registry).toBe(consoleRegistries.imports);
    expect(dependencies.channel.registry).toBe(consoleRegistries.extensions);
  });
});
