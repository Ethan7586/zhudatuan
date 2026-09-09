import { expect, type Page } from '@playwright/test';

export type VisualIntegrityKind = 'documentoverflow' | 'textclipped' | 'touchtarget' | 'viewportbreach';

export interface VisualIntegrityIssue {
  readonly kind: VisualIntegrityKind;
  readonly element: string;
  readonly text?: string;
  readonly actual: string;
}

export async function expectVisualIntegrity(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const issues = await inspectVisualIntegrity(page);
  expect(issues, describe(issues)).toEqual([]);
}

export function inspectVisualIntegrity(page: Page): Promise<readonly VisualIntegrityIssue[]> {
  return page.evaluate(() => {
    const issues: VisualIntegrityIssue[] = [];
    const viewportWidth = document.documentElement.clientWidth;
    const candidates = document.querySelectorAll<HTMLElement>('a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="tab"],[role="radio"],[role="checkbox"],h1,h2,h3,p,span,strong,small,li,dt,dd,td,th');

    if (document.documentElement.scrollWidth > viewportWidth + 1) {
      issues.push({ kind: 'documentoverflow', element: 'html', actual: `${document.documentElement.scrollWidth}px > ${viewportWidth}px` });
    }

    for (const element of candidates) {
      if (!visuallyPresented(element)) continue;
      const style = getComputedStyle(element);
      const text = readableText(element);
      const clippedX = text.length > 0 && hiddenOverflow(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const clippedY = text.length > 0 && hiddenOverflow(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      if (clippedX || clippedY) {
        issues.push({
          kind: 'textclipped',
          element: identify(element),
          text,
          actual: `${element.clientWidth}×${element.clientHeight}px viewport / ${element.scrollWidth}×${element.scrollHeight}px content`,
        });
      }

      const rect = element.getBoundingClientRect();
      const intersectsViewport = rect.right > 1 && rect.left < viewportWidth - 1;
      if (text.length > 0 && intersectsViewport && horizontalScrollContainer(element) === null && (rect.left < -1 || rect.right > viewportWidth + 1)) {
        issues.push({ kind: 'viewportbreach', element: identify(element), text, actual: `${Math.round(rect.left)}px…${Math.round(rect.right)}px / ${viewportWidth}px viewport` });
      }

      if (viewportWidth <= 768 && interactive(element)) {
        const target = effectiveTarget(element);
        if (target.width + 0.5 < 44 || target.height + 0.5 < 44) {
          issues.push({ kind: 'touchtarget', element: identify(element), ...(text.length === 0 ? {} : { text }), actual: `${Math.round(target.width)}×${Math.round(target.height)}px / 44×44px minimum` });
        }
      }
    }
    return issues;

    function visuallyPresented(element: HTMLElement): boolean {
      if (element.closest('.sr-only,[hidden],[aria-hidden="true"]')) return false;
      const closed = element.closest('details:not([open])');
      if (closed) {
        const summary = closed.querySelector(':scope > summary');
        if (!summary?.contains(element)) return false;
      }
      let ancestor: HTMLElement | null = element;
      while (ancestor) {
        const ancestorStyle = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden' || Number(ancestorStyle.opacity) === 0) return false;
        if (ancestor !== element && hiddenOverflow(ancestorStyle.overflow) && ancestorRect.width <= 1 && ancestorRect.height <= 1) return false;
        if (ancestor !== element && (ancestorStyle.clipPath === 'inset(50%)' || ancestorStyle.clip === 'rect(0px, 0px, 0px, 0px)')) return false;
        ancestor = ancestor.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    }

    function horizontalScrollContainer(element: HTMLElement): HTMLElement | null {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflow = getComputedStyle(ancestor).overflowX;
        if ((overflow === 'auto' || overflow === 'scroll') && ancestor.scrollWidth > ancestor.clientWidth + 1) return ancestor;
        ancestor = ancestor.parentElement;
      }
      return null;
    }

    function effectiveTarget(element: HTMLElement): DOMRect {
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        const label = element.closest('label');
        if (label && visuallyPresented(label)) return label.getBoundingClientRect();
      }
      return element.getBoundingClientRect();
    }

    function interactive(element: HTMLElement): boolean {
      if (element instanceof HTMLAnchorElement) return element.hasAttribute('href');
      return element.matches('button,input,select,textarea,summary,[role="button"],[role="tab"],[role="radio"],[role="checkbox"]');
    }

    function readableText(element: HTMLElement): string {
      return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    function identify(element: HTMLElement): string {
      const id = element.id ? `#${element.id}` : '';
      const classes =
        typeof element.className === 'string'
          ? element.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 3)
              .map((name) => `.${name}`)
              .join('')
          : '';
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    }

    function hiddenOverflow(value: string): boolean {
      return value === 'hidden' || value === 'clip';
    }
  });
}

function describe(issues: readonly VisualIntegrityIssue[]): string {
  if (issues.length === 0) return 'visual integrity accepted';
  return [
    'visual integrity violations:',
    ...issues.slice(0, 30).map(({ kind, element, text, actual }) => `- ${kind} ${element}${text ? ` “${text}”` : ''}: ${actual}`),
    ...(issues.length > 30 ? [`- …and ${issues.length - 30} more`] : []),
  ].join('\n');
}
