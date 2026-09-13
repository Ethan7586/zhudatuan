import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/main.tsx', 'utf8');

describe('identity bootstrap performance', () => {
  it('renders a build-known identity node before the runtime request settles', () => {
    expect(source.indexOf('const node = configuredIdentityNode();'))
      .toBeLessThan(source.indexOf('void loadIdentityNodeRuntime()'));
    expect(source).toContain('if (renderedFromBuild) return');
    expect(source).toContain('if (!renderedFromBuild) {');
  });

  it('warms the selected API and destination origins before the user submits login', () => {
    expect(source).toContain("link.rel = 'preconnect'");
    expect(source).toContain("link.crossOrigin = 'use-credentials'");
    expect(source).toContain('warmIdentityConnections(node);');
  });
});
