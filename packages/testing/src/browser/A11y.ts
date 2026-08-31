import axe, { type AxeResults, type RunOptions } from 'axe-core';

export function auditA11y(root: Element | Document, options?: RunOptions): Promise<AxeResults> {
  return options === undefined ? axe.run(root) : axe.run(root, options);
}

export function assertNoA11yViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const details = results.violations.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`).join('\n');
  throw new Error(`ACCESSIBILITY_VIOLATIONS\n${details}`);
}
