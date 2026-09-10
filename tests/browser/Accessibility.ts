import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const DOUBLE_TEXT_SCALE = 'html{font-size:200% !important}';

export async function applyDoubleTextScale(page: Page): Promise<void> {
  await page.addStyleTag({ content: DOUBLE_TEXT_SCALE });
  await page.evaluate(() => document.fonts.ready);
}

export async function expectWcagAA(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations, describe(result.violations)).toEqual([]);
}

function describe(violations: readonly { id: string; impact?: string | null; nodes: readonly { target: readonly string[] }[] }[]): string {
  return violations.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`).join('\n');
}
