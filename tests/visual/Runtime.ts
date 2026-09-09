import { expect, type Page } from '@playwright/test';
import { expectResponsivePage } from '../browser/Environment';
import { expectVisualIntegrity, expectVisualReady } from '../../scripts/check/VisualIntegrity';

const faults = new WeakMap<Page, string[]>();

export async function prepareVisual(page: Page, viewport: Readonly<{ width: number; height: number }>): Promise<void> {
  const errors: string[] = [];
  faults.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

export function resetVisual(page: Page): void {
  faults.get(page)?.splice(0);
}

export async function expectUsable(page: Page): Promise<void> {
  await expectVisualReady(page);
  await expectResponsivePage(page);
  await expectVisualIntegrity(page);
  expect(faults.get(page) ?? []).toEqual([]);
}

export function fillRoute(template: string, parameters: Readonly<Record<string, string>>): string {
  return template.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => encodeURIComponent(parameters[name] ?? `missing:${name}`));
}
