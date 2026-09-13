import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/main.tsx', 'utf8');

describe('identity bootstrap performance', () => {
  it('renders a build-known identity node before the runtime request settles', () => {
    expect(source.indexOf('if (configuredIdentityNode() !== null) renderApp()'))
      .toBeLessThan(source.indexOf('void loadIdentityNodeRuntime()'));
    expect(source).toContain('if (renderedFromBuild) return');
    expect(source).toContain('if (!renderedFromBuild) {');
  });
});
