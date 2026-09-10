import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parse } from 'yaml';

export type VisualIntegrityKind = 'controlcopyboundary' | 'controlcopymultiline' | 'controlcopyoverflow' | 'controloccluded' | 'documentoverflow' | 'imagefailure' | 'technicalidentity' | 'textclipped' | 'touchtarget' | 'viewportbreach';

export interface VisualViewport {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export interface VisualIntegrityIssue {
  readonly kind: VisualIntegrityKind;
  readonly element: string;
  readonly text?: string;
  readonly actual: string;
}

interface VisualAuthority {
  readonly viewports?: Readonly<Record<string, Readonly<{ width?: unknown; height?: unknown }>>>;
}

const visualAuthority = parse(readFileSync(new URL('../../config/visuals.yml', import.meta.url), 'utf8')) as VisualAuthority;

export const VISUAL_VIEWPORTS = Object.freeze(
  Object.entries(visualAuthority.viewports ?? {}).map(([name, viewport]) => {
    if (!Number.isSafeInteger(viewport.width) || !Number.isSafeInteger(viewport.height)) throw new Error(`VISUAL_VIEWPORT_INVALID:${name}`);
    return Object.freeze({ name, width: viewport.width as number, height: viewport.height as number });
  })
);

if (VISUAL_VIEWPORTS.length === 0) throw new Error('VISUAL_VIEWPORTS_EMPTY');

export async function expectVisualReady(page: Page): Promise<void> {
  await page.locator('main:visible').first().waitFor({ state: 'visible' });
  await expect
    .poll(() => inspectVisualReadiness(page), {
      message: 'the visual gate must inspect settled business content, not a loading or session-check placeholder',
      timeout: 20_000,
      intervals: [50, 100, 250, 500],
    })
    .toEqual([]);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export function inspectVisualReadiness(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const blockers: string[] = [];
    const loadingCopy = /正在(?:加载|准备|验证|校验|读取|同步|打开|生成|获取|刷新|重试)/;
    const candidates = document.querySelectorAll<HTMLElement>('.storefrontloading,.authloading,.statemain,[aria-busy="true"],[role="status"]');
    for (const element of candidates) {
      if (!presented(element)) continue;
      const copy = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const routePlaceholder = element.matches('.storefrontloading,.authloading,.statemain');
      if (!routePlaceholder && element.getAttribute('aria-busy') !== 'true' && !loadingCopy.test(copy)) continue;
      const identity = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${
        typeof element.className === 'string'
          ? element.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((name) => `.${name}`)
              .join('')
          : ''
      }`;
      if (!blockers.some((item) => item.startsWith(`${identity}:`))) blockers.push(`${identity}: ${copy.slice(0, 100) || 'busy'}`);
    }
    for (const image of document.querySelectorAll<HTMLImageElement>('img[src]')) {
      if (presented(image) && !image.complete) blockers.push(`img: waiting for ${image.alt.trim() || 'image resource'}`);
    }
    return blockers;

    function presented(element: HTMLElement): boolean {
      if (element.closest('.sr-only,[hidden],[inert],[aria-hidden="true"]')) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight
      );
    }
  });
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

    for (const image of document.querySelectorAll<HTMLImageElement>('img[src]')) {
      if (visuallyPresented(image) && image.complete && image.naturalWidth === 0) {
        issues.push({ kind: 'imagefailure', element: identify(image), ...(image.alt.trim().length === 0 ? {} : { text: image.alt.trim().slice(0, 120) }), actual: 'visible image failed to load' });
      }
    }

    for (const element of candidates) {
      if (!visuallyPresented(element)) continue;
      const style = getComputedStyle(element);
      const text = readableText(element);
      const rect = element.getBoundingClientRect();
      const copyRects = text.length === 0 ? [] : textNodeRects(element);
      const copyOwners = text.length === 0 ? [] : textNodeOwners(element);
      const exposedIdentity = technicalIdentity(directReadableText(element));
      if (exposedIdentity && element.closest('[data-visual-identity="required"]') === null) {
        issues.push({ kind: 'technicalidentity', element: identify(element), text: exposedIdentity, actual: 'internal identity exposed without an explicit business requirement' });
      }
      const clippedOwners = copyOwners.filter((owner) => {
        const ownerStyle = getComputedStyle(owner);
        return (hiddenOverflow(ownerStyle.overflowX) && owner.scrollWidth > owner.clientWidth + 1) || (hiddenOverflow(ownerStyle.overflowY) && owner.scrollHeight > owner.clientHeight + 1);
      });
      const unpermittedClipping = clippedOwners.some((owner) => !permittedTruncation(owner, getComputedStyle(owner)));
      const clippedX = clippedOwners.some((owner) => owner.scrollWidth > owner.clientWidth + 1);
      const clippedY = clippedOwners.some((owner) => owner.scrollHeight > owner.clientHeight + 1);
      if (unpermittedClipping && !permittedTruncation(element, style)) {
        issues.push({
          kind: 'textclipped',
          element: identify(element),
          text,
          actual: `${element.clientWidth}×${element.clientHeight}px viewport / ${element.scrollWidth}×${element.scrollHeight}px content`,
        });
      }

      const isControl = control(element);
      if (text.length > 0 && isControl && !permittedControlTruncation(element)) {
        const outside = copyRects.find((copy) => copy.left < rect.left - 1 || copy.right > rect.right + 1 || copy.top < rect.top - 1 || copy.bottom > rect.bottom + 1);
        if (outside) {
          issues.push({
            kind: 'controlcopyboundary',
            element: identify(element),
            text,
            actual: `${Math.round(outside.left)}px…${Math.round(outside.right)}px × ${Math.round(outside.top)}px…${Math.round(outside.bottom)}px outside ${Math.round(rect.left)}px…${Math.round(rect.right)}px × ${Math.round(rect.top)}px…${Math.round(rect.bottom)}px control`,
          });
        }
      }
      const copyOverflowX = text.length > 0 && isControl && copyRects.some((copy) => copy.left < rect.left - 1 || copy.right > rect.right + 1);
      const copyOverflowY = text.length > 0 && isControl && copyRects.some((copy) => copy.top < rect.top - 1 || copy.bottom > rect.bottom + 1);
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

      if (interactive(element)) {
        const obstruction = occludingElement(element, rect);
        if (obstruction) {
          issues.push({ kind: 'controloccluded', element: identify(element), ...(text.length === 0 ? {} : { text }), actual: `center is covered by ${identify(obstruction)}` });
        }
      }
    }
    return issues;

    function visuallyPresented(element: HTMLElement): boolean {
      if (element.closest('.sr-only,[hidden],[inert],[aria-hidden="true"]')) return false;
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
      const clampedLines = Number.parseInt(style.getPropertyValue('-webkit-line-clamp'), 10);
      if (owner === null || (style.textOverflow !== 'ellipsis' && !(Number.isFinite(clampedLines) && clampedLines > 0))) return false;
      const fullCopy = owner.getAttribute('aria-label') ?? owner.getAttribute('title');
      return (fullCopy ?? '').trim().length > 0;
    }

    function permittedControlTruncation(element: HTMLElement): boolean {
      if (element.dataset.visualCopy !== 'truncate') return false;
      const fullCopy = element.getAttribute('aria-label') ?? element.getAttribute('title');
      if ((fullCopy ?? '').trim().length === 0) return false;
      return [element, ...element.querySelectorAll<HTMLElement>('*')].some((candidate) => getComputedStyle(candidate).textOverflow === 'ellipsis');
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

    function textNodeRects(element: HTMLElement): readonly DOMRect[] {
      const rectangles: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const owner = node.parentElement;
        if ((node.textContent ?? '').trim().length > 0 && owner && visuallyPresented(owner) && ownsTextNode(element, owner)) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) rectangles.push(rect);
        }
        node = walker.nextNode();
      }
      return rectangles;
    }

    function textNodeOwners(element: HTMLElement): readonly HTMLElement[] {
      const owners = new Set<HTMLElement>();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const owner = node.parentElement;
        if ((node.textContent ?? '').trim().length > 0 && owner && visuallyPresented(owner) && ownsTextNode(element, owner)) owners.add(owner);
        node = walker.nextNode();
      }
      return [...owners];
    }

    function ownsTextNode(element: HTMLElement, owner: HTMLElement): boolean {
      const nearestControl = owner.closest<HTMLElement>('a[href],button,summary,[role="button"],[role="tab"],[role="radio"],[role="checkbox"]');
      return control(element) ? nearestControl === element : nearestControl === null || !element.contains(nearestControl);
    }

    function occludingElement(element: HTMLElement, rect: DOMRect): HTMLElement | null {
      const visible = visibleRectangle(element, rect);
      if (visible === null) return null;
      const centerX = visible.left + (visible.right - visible.left) / 2;
      const centerY = visible.top + (visible.bottom - visible.top) / 2;
      const top = document.elementFromPoint(centerX, centerY);
      if (!(top instanceof HTMLElement) || element === top || element.contains(top) || top.contains(element)) return null;
      const blocker = fixedLayer(top);
      if (blocker && fixedLayer(element) === null && canScrollClear(rect, blocker.getBoundingClientRect())) return null;
      return top;
    }

    function visibleRectangle(element: HTMLElement, rect: DOMRect): Readonly<{ left: number; right: number; top: number; bottom: number }> | null {
      let left = Math.max(0, rect.left);
      let right = Math.min(document.documentElement.clientWidth, rect.right);
      let top = Math.max(0, rect.top);
      let bottom = Math.min(document.documentElement.clientHeight, rect.bottom);
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const style = getComputedStyle(ancestor);
        const bounds = ancestor.getBoundingClientRect();
        if (clipsOverflow(style.overflowX)) {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        if (clipsOverflow(style.overflowY)) {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
        ancestor = ancestor.parentElement;
      }
      return right - left > 1 && bottom - top > 1 ? { left, right, top, bottom } : null;
    }

    function clipsOverflow(value: string): boolean {
      return hiddenOverflow(value) || value === 'auto' || value === 'scroll';
    }

    function fixedLayer(element: HTMLElement): HTMLElement | null {
      let candidate: HTMLElement | null = element;
      while (candidate) {
        const position = getComputedStyle(candidate).position;
        if (position === 'fixed' || position === 'sticky') return candidate;
        candidate = candidate.parentElement;
      }
      return null;
    }

    function canScrollClear(target: DOMRect, blocker: DOMRect): boolean {
      const viewportHeight = document.documentElement.clientHeight;
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const maximumScrollY = Math.max(0, documentHeight - viewportHeight);
      const minimumCenter = Math.max(target.height / 2, target.top + target.height / 2 - (maximumScrollY - window.scrollY));
      const maximumCenter = Math.min(viewportHeight - target.height / 2, target.top + target.height / 2 + window.scrollY);
      return minimumCenter < blocker.top - 1 || maximumCenter > blocker.bottom + 1;
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
