import { expect, type Locator, type Page } from '@playwright/test';

export type VisualIntegrityKind = 'controlcopymultiline' | 'controlcopyoverflow' | 'documentoverflow' | 'technicalidentity' | 'textclipped' | 'touchtarget' | 'viewportbreach';

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

export function elementCopyFits(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1);
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
      const exposedIdentity = technicalIdentity(directReadableText(element));
      if (exposedIdentity && element.closest('[data-visual-identity="required"]') === null) {
        issues.push({ kind: 'technicalidentity', element: identify(element), text: exposedIdentity, actual: 'internal identity exposed without an explicit business requirement' });
      }
      const clippedX = text.length > 0 && hiddenOverflow(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const clippedY = text.length > 0 && hiddenOverflow(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      if ((clippedX || clippedY) && !permittedTruncation(element, style)) {
        issues.push({
          kind: 'textclipped',
          element: identify(element),
          text,
          actual: `${element.clientWidth}×${element.clientHeight}px viewport / ${element.scrollWidth}×${element.scrollHeight}px content`,
        });
      }

      const isControl = control(element);
      const copyOverflowX = text.length > 0 && isControl && element.scrollWidth > element.clientWidth + 1;
      const copyOverflowY = text.length > 0 && isControl && element.scrollHeight > element.clientHeight + 1;
      if ((copyOverflowX || copyOverflowY) && !clippedX && !clippedY) {
        issues.push({
          kind: 'controlcopyoverflow',
          element: identify(element),
          text,
          actual: `${element.clientWidth}×${element.clientHeight}px control / ${element.scrollWidth}×${element.scrollHeight}px content`,
        });
      }

      if (text.length > 0 && isControl && element.dataset.visualCopy !== 'multiline') {
        const lines = maximumTextNodeLines(element);
        if (lines > 1) {
          issues.push({
            kind: 'controlcopymultiline',
            element: identify(element),
            text,
            actual: `${lines} rendered text lines / 1 line required`,
          });
        }
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

    function permittedTruncation(element: HTMLElement, style: CSSStyleDeclaration): boolean {
      const owner = element.closest<HTMLElement>('[data-visual-copy="truncate"]');
      if (owner === null || style.textOverflow !== 'ellipsis') return false;
      const fullCopy = owner.getAttribute('aria-label') ?? owner.getAttribute('title');
      return (fullCopy ?? '').trim().length > 0;
    }

    function control(element: HTMLElement): boolean {
      return element.matches('a[href],button,summary,[role="button"],[role="tab"],[role="radio"],[role="checkbox"]');
    }

    function maximumTextNodeLines(element: HTMLElement): number {
      let maximum = 0;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const owner = node.parentElement;
        if ((node.textContent ?? '').trim().length > 0 && owner && visuallyPresented(owner)) {
          const centers: number[] = [];
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width <= 0 || rect.height <= 0) continue;
            const center = rect.top + rect.height / 2;
            if (!centers.some((known) => Math.abs(known - center) <= 1)) centers.push(center);
          }
          maximum = Math.max(maximum, centers.length);
        }
        node = walker.nextNode();
      }
      return maximum;
    }

    function readableText(element: HTMLElement): string {
      return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    function directReadableText(element: HTMLElement): string {
      return [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    }

    function technicalIdentity(text: string): string | null {
      if (!text) return null;
      const patterns = [
        /\b(?:address|application|benefit(?:account)?|campaign|cart|case|channel|checkout|department|enterprise|fulfillment|invoice|journal|listing|mall|member|membership|order|organization|partner|payment|permission|pool|principal|product|promotion|provider|quote|reconciliation|role|scope|settlement|shipment|sku|stock(?:item)?|store|supplier|tenant|ticket|voucher|warehouse):[A-Za-z0-9][A-Za-z0-9.:/_-]*\b/i,
        /\b(?:application|department|enterprise|listing|mall|member|membership|organization|pool|product|sku|stock|tenant)-[A-Za-z0-9][A-Za-z0-9_-]{2,}\b/i,
        /\b[A-Z]{2,}_[A-Z0-9]+(?:_[A-Z0-9]+)+\b/,
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0];
      }
      return null;
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
