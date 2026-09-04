import type { ExperienceAction as BlockAction, ExperienceComponentType } from '@shop/contract';
import type { ExperienceBlock, ExperienceDocument } from './Experience';
import { createComponent } from './ComponentCatalog';
import { themePreset } from './ThemePreset';

export function changeTheme(source: ExperienceDocument, preset: ExperienceDocument['theme']['preset']): ExperienceDocument {
  return Object.freeze({ ...source, theme: themePreset(preset).theme });
}

export function patchTheme(source: ExperienceDocument, patch: Partial<ExperienceDocument['theme']>): ExperienceDocument {
  return Object.freeze({ ...source, theme: Object.freeze({ ...source.theme, ...patch }) });
}

export function addPage(source: ExperienceDocument, id: string): ExperienceDocument {
  const ordinal = source.pages.length + 1;
  const page = Object.freeze({ id, path: `page-${ordinal}`, blocks: Object.freeze([]) });
  const item = Object.freeze({ id: `${id}:navigation`, label: `页面 ${ordinal}`, page: id });
  return Object.freeze({ ...source, navigation: Object.freeze([...source.navigation, item]), pages: Object.freeze([...source.pages, page]) });
}

export function patchPage(source: ExperienceDocument, index: number, patch: Readonly<{ path?: string; label?: string }>): ExperienceDocument {
  const selected = source.pages[index];
  if (!selected) return source;
  const pages = source.pages.map((page, candidate) => (candidate === index && patch.path !== undefined ? Object.freeze({ ...page, path: patch.path }) : page));
  const navigation = source.navigation.map((item) => (item.page === selected.id && patch.label !== undefined ? Object.freeze({ ...item, label: patch.label }) : item));
  return Object.freeze({ ...source, navigation: Object.freeze(navigation), pages: Object.freeze(pages) });
}

export function removePage(source: ExperienceDocument, index: number): ExperienceDocument {
  const selected = source.pages[index];
  if (!selected || selected.path === 'home' || source.pages.length === 1) return source;
  return Object.freeze({
    ...source,
    navigation: Object.freeze(source.navigation.filter((item) => item.page !== selected.id && item.page !== selected.path)),
    pages: Object.freeze(source.pages.filter((_, candidate) => candidate !== index)),
  });
}

export function addBlock(source: ExperienceDocument, page: number, type: ExperienceComponentType, id: string): ExperienceDocument {
  return withPage(source, page, (selected) => Object.freeze({ ...selected, blocks: Object.freeze([...selected.blocks, createComponent(type, id)]) }));
}

export function removeBlock(source: ExperienceDocument, page: number, block: number): ExperienceDocument {
  return withPage(source, page, (selected) => Object.freeze({ ...selected, blocks: Object.freeze(selected.blocks.filter((_, index) => index !== block)) }));
}

export function moveBlock(source: ExperienceDocument, page: number, block: number, offset: -1 | 1): ExperienceDocument {
  return withPage(source, page, (selected) => {
    const target = block + offset;
    if (target < 0 || target >= selected.blocks.length) return selected;
    const blocks = [...selected.blocks];
    [blocks[block], blocks[target]] = [blocks[target]!, blocks[block]!];
    return Object.freeze({ ...selected, blocks: Object.freeze(blocks) });
  });
}

export function patchBlockContent(source: ExperienceDocument, page: number, block: number, content: ExperienceBlock['content']): ExperienceDocument {
  return patchBlock(source, page, block, (selected) => Object.freeze({ ...selected, content: Object.freeze(content) }));
}

export function patchBlockAction(source: ExperienceDocument, page: number, block: number, action: BlockAction | undefined): ExperienceDocument {
  return patchBlock(source, page, block, (selected) => (action ? Object.freeze({ ...selected, action: Object.freeze(action) }) : Object.freeze({ id: selected.id, component: selected.component, content: selected.content })));
}

function patchBlock(source: ExperienceDocument, page: number, block: number, change: (selected: ExperienceBlock) => ExperienceBlock): ExperienceDocument {
  return withPage(source, page, (selected) => Object.freeze({ ...selected, blocks: Object.freeze(selected.blocks.map((item, index) => (index === block ? change(item) : item))) }));
}

function withPage(source: ExperienceDocument, index: number, change: (page: ExperienceDocument['pages'][number]) => ExperienceDocument['pages'][number]): ExperienceDocument {
  if (!source.pages[index]) return source;
  return Object.freeze({ ...source, pages: Object.freeze(source.pages.map((page, candidate) => (candidate === index ? change(page) : page))) });
}
