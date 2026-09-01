import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import type { Result } from 'axe-core';

export async function expectWcagAA(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations, describe(result.violations)).toEqual([]);
}

function describe(violations: readonly Result[]): string {
  return violations.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}: ${violation.nodes.map((node) => targetLabel(node.target)).join(', ')}`).join('\n');
}

function targetLabel(target: Result['nodes'][number]['target']): string {
  return target.map((selector) => Array.isArray(selector) ? selector.join(' >>> ') : selector).join(' ');
}
