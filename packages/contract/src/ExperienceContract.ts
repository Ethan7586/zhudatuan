import { objectValue } from './schema';

export const EXPERIENCE_VERSION = 2 as const;
export const EXPERIENCE_ACTIONS = ['link', 'product', 'category', 'collection', 'exchangeableproduct', 'micropage', 'marketingactivity'] as const;
export const EXPERIENCE_COMPONENTS = ['hero', 'notice', 'shortcut', 'productcollection', 'richtext'] as const;
export type ExperienceActionType = (typeof EXPERIENCE_ACTIONS)[number];
export type ExperienceComponentType = (typeof EXPERIENCE_COMPONENTS)[number];

export interface ExperienceAction {
  readonly type: ExperienceActionType;
  readonly target: string;
}
export interface ExperienceBlock {
  readonly id: string;
  readonly component: ExperienceComponentType;
  readonly content: Readonly<Record<string, unknown>>;
  readonly action?: ExperienceAction;
}
export interface ExperiencePage {
  readonly id: string;
  readonly path: string;
  readonly blocks: readonly ExperienceBlock[];
}
export interface ExperienceNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly page: string;
}
export interface ExperienceTheme {
  readonly preset: 'shop' | 'market' | 'governance';
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly logoObjectRef: string | null;
  readonly faviconObjectRef: string | null;
}
export interface ExperienceDocument {
  readonly version: typeof EXPERIENCE_VERSION;
  readonly application: string;
  readonly theme: ExperienceTheme;
  readonly navigation: readonly ExperienceNavigationItem[];
  readonly assets: readonly string[];
  readonly pages: readonly ExperiencePage[];
}

export function parseExperience(value: unknown): ExperienceDocument {
  const source = objectValue(value);
  if (source.version !== EXPERIENCE_VERSION) throw new Error('EXPERIENCE_VERSION_INVALID');
  const application = required(source.application, 'EXPERIENCE_APPLICATION_INVALID');
  const theme = parseExperienceTheme(source.theme);
  if (!Array.isArray(source.navigation) || source.navigation.length === 0 || source.navigation.length > 20) throw new Error('EXPERIENCE_NAVIGATION_INVALID');
  const navigation = source.navigation.map(parseNavigation);
  if (new Set(navigation.map((item) => item.id)).size !== navigation.length) throw new Error('EXPERIENCE_NAVIGATION_DUPLICATE');
  if (!Array.isArray(source.assets) || source.assets.length > 100) throw new Error('EXPERIENCE_ASSETS_INVALID');
  const assets = source.assets.map((asset) => reference(asset, false));
  if (new Set(assets).size !== assets.length) throw new Error('EXPERIENCE_ASSET_DUPLICATE');
  if (!Array.isArray(source.pages) || source.pages.length === 0 || source.pages.length > 100) throw new Error('EXPERIENCE_PAGES_INVALID');
  const pages = source.pages.map((page) => parsePage(page));
  if (new Set(pages.map((page) => page.path)).size !== pages.length) throw new Error('EXPERIENCE_PAGE_PATH_DUPLICATE');
  return Object.freeze({ version: EXPERIENCE_VERSION, application, theme, navigation: Object.freeze(navigation), assets: Object.freeze(assets), pages: Object.freeze(pages) });
}

export function serializeExperience(value: unknown): string {
  return JSON.stringify(canonical(parseExperience(value)));
}

function parsePage(value: unknown): ExperiencePage {
  const source = objectValue(value);
  const blocks = Array.isArray(source.blocks) ? source.blocks.map(parseBlock) : [];
  if (blocks.length > 200) throw new Error('EXPERIENCE_BLOCKS_INVALID');
  return Object.freeze({ id: required(source.id, 'EXPERIENCE_PAGE_ID_INVALID'), path: required(source.path, 'EXPERIENCE_PAGE_PATH_INVALID'), blocks: Object.freeze(blocks) });
}

function parseBlock(value: unknown): ExperienceBlock {
  const source = objectValue(value);
  const action = source.action === undefined ? undefined : parseAction(source.action);
  const component = required(source.component, 'EXPERIENCE_COMPONENT_INVALID');
  if (!EXPERIENCE_COMPONENTS.includes(component as ExperienceComponentType)) throw new Error('EXPERIENCE_COMPONENT_INVALID');
  return Object.freeze({
    id: required(source.id, 'EXPERIENCE_BLOCK_ID_INVALID'),
    component: component as ExperienceComponentType,
    content: parseContent(component as ExperienceComponentType, source.content),
    ...(action === undefined ? {} : { action }),
  });
}

function parseAction(value: unknown): ExperienceAction {
  const source = objectValue(value);
  if (!EXPERIENCE_ACTIONS.includes(source.type as ExperienceActionType)) throw new Error('EXPERIENCE_ACTION_INVALID');
  return Object.freeze({ type: source.type as ExperienceActionType, target: required(source.target, 'EXPERIENCE_ACTION_TARGET_INVALID') });
}

function parseNavigation(value: unknown): ExperienceNavigationItem {
  const source = objectValue(value);
  return Object.freeze({
    id: required(source.id, 'EXPERIENCE_NAVIGATION_ID_INVALID'),
    label: required(source.label, 'EXPERIENCE_NAVIGATION_LABEL_INVALID'),
    page: required(source.page, 'EXPERIENCE_NAVIGATION_PAGE_INVALID'),
  });
}

export function parseExperienceTheme(value: unknown): ExperienceTheme {
  const source = objectValue(value);
  if (!['shop', 'market', 'governance'].includes(String(source.preset))) throw new Error('EXPERIENCE_THEME_PRESET_INVALID');
  const primaryColor = color(source.primaryColor);
  const accentColor = color(source.accentColor);
  return Object.freeze({
    preset: source.preset as ExperienceTheme['preset'],
    primaryColor,
    accentColor,
    logoObjectRef: reference(source.logoObjectRef, true),
    faviconObjectRef: reference(source.faviconObjectRef, true),
  });
}

function parseContent(component: ExperienceComponentType, value: unknown): Readonly<Record<string, unknown>> {
  const source = objectValue(value);
  if (component === 'hero') {
    only(source, ['eyebrow', 'title', 'subtitle', 'description', 'image', 'objectRef']);
    const title = bounded(source.title, 1, 80, 'EXPERIENCE_HERO_TITLE_INVALID');
    return frozen({
      ...(source.eyebrow === undefined ? {} : { eyebrow: bounded(source.eyebrow, 0, 40, 'EXPERIENCE_HERO_EYEBROW_INVALID') }),
      title,
      ...(source.subtitle === undefined ? {} : { subtitle: bounded(source.subtitle, 0, 160, 'EXPERIENCE_HERO_SUBTITLE_INVALID') }),
      ...(source.description === undefined ? {} : { description: bounded(source.description, 0, 300, 'EXPERIENCE_HERO_DESCRIPTION_INVALID') }),
      ...(source.image === undefined ? {} : { image: reference(source.image, false) }),
      ...(source.objectRef === undefined ? {} : { objectRef: reference(source.objectRef, false) }),
    });
  }
  if (component === 'notice') {
    only(source, ['announcement', 'text']);
    const announcement = source.announcement ?? source.text;
    if (announcement === undefined) throw new Error('EXPERIENCE_NOTICE_TEXT_INVALID');
    return frozen(source.announcement === undefined ? { text: bounded(announcement, 1, 300, 'EXPERIENCE_NOTICE_TEXT_INVALID') } : { announcement: bounded(announcement, 1, 300, 'EXPERIENCE_NOTICE_TEXT_INVALID') });
  }
  if (component === 'shortcut') {
    only(source, ['title', 'items']);
    if (!Array.isArray(source.items) || source.items.length < 1 || source.items.length > 8) throw new Error('EXPERIENCE_SHORTCUT_ITEMS_INVALID');
    const items = source.items.map((item) => {
      const entry = objectValue(item);
      only(entry, ['id', 'label', 'icon', 'visible', 'action']);
      if (entry.visible !== undefined && typeof entry.visible !== 'boolean') throw new Error('EXPERIENCE_SHORTCUT_VISIBLE_INVALID');
      return frozen({
        id: required(entry.id, 'EXPERIENCE_SHORTCUT_ID_INVALID'),
        label: bounded(entry.label, 1, 20, 'EXPERIENCE_SHORTCUT_LABEL_INVALID'),
        icon: icon(entry.icon),
        ...(entry.visible === undefined ? {} : { visible: entry.visible }),
        ...(entry.action === undefined ? {} : { action: parseAction(entry.action) }),
      });
    });
    if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('EXPERIENCE_SHORTCUT_ID_DUPLICATE');
    return frozen({ title: bounded(source.title, 1, 40, 'EXPERIENCE_SHORTCUT_TITLE_INVALID'), items: Object.freeze(items) });
  }
  if (component === 'productcollection') {
    only(source, ['title', 'subtitle', 'collectionId', 'pool', 'displayLimit', 'productIds', 'listingIds']);
    const collection = source.collectionId ?? source.pool;
    if (collection === undefined) throw new Error('EXPERIENCE_COLLECTION_INVALID');
    const displayLimit = source.displayLimit === undefined ? 4 : source.displayLimit;
    if (![2, 4, 6, 8].includes(Number(displayLimit)) || !Number.isSafeInteger(displayLimit)) throw new Error('EXPERIENCE_COLLECTION_LIMIT_INVALID');
    return frozen({
      ...(source.title === undefined ? {} : { title: bounded(source.title, 1, 80, 'EXPERIENCE_COLLECTION_TITLE_INVALID') }),
      ...(source.subtitle === undefined ? {} : { subtitle: bounded(source.subtitle, 0, 160, 'EXPERIENCE_COLLECTION_SUBTITLE_INVALID') }),
      ...(source.collectionId === undefined ? {} : { collectionId: required(collection, 'EXPERIENCE_COLLECTION_INVALID') }),
      ...(source.pool === undefined ? {} : { pool: required(collection, 'EXPERIENCE_COLLECTION_INVALID') }),
      displayLimit,
      ...(source.productIds === undefined ? {} : { productIds: references(source.productIds, 'EXPERIENCE_COLLECTION_PRODUCTS_INVALID') }),
      ...(source.listingIds === undefined ? {} : { listingIds: references(source.listingIds, 'EXPERIENCE_COLLECTION_LISTINGS_INVALID') }),
    });
  }
  only(source, ['title', 'text', 'content']);
  const content = source.content ?? source.text;
  if (content === undefined) throw new Error('EXPERIENCE_RICHTEXT_CONTENT_INVALID');
  return frozen({
    ...(source.title === undefined ? {} : { title: bounded(source.title, 1, 80, 'EXPERIENCE_RICHTEXT_TITLE_INVALID') }),
    ...(source.content === undefined ? {} : { content: bounded(content, 1, 2000, 'EXPERIENCE_RICHTEXT_CONTENT_INVALID') }),
    ...(source.text === undefined ? {} : { text: bounded(content, 1, 2000, 'EXPERIENCE_RICHTEXT_CONTENT_INVALID') }),
  });
}

function only(source: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(source).some((key) => !fields.includes(key))) throw new Error('EXPERIENCE_COMPONENT_CONTENT_INVALID');
}

function bounded(value: unknown, minimum: number, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}

function icon(value: unknown): string {
  const result = required(value, 'EXPERIENCE_SHORTCUT_ICON_INVALID');
  if (!['building', 'map-pin', 'ticket', 'store', 'gift', 'star', 'grid', 'link'].includes(result)) throw new Error('EXPERIENCE_SHORTCUT_ICON_INVALID');
  return result;
}

function references(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(code);
  const result = value.map((item) => reference(item, false));
  if (new Set(result).size !== result.length) throw new Error(code);
  return Object.freeze(result);
}

function frozen(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.freeze(value);
}

function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9A-F]{6}$/.test(value)) throw new Error('EXPERIENCE_THEME_COLOR_INVALID');
  return value;
}

function reference(value: unknown, nullable: true): string | null;
function reference(value: unknown, nullable: false): string;
function reference(value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || value.length < 3 || value.length > 512 || !/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/_-]*$/.test(value)) {
    throw new Error('EXPERIENCE_THEME_ASSET_INVALID');
  }
  return value;
}

function required(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) throw new Error(code);
  return value.trim();
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  throw new Error('EXPERIENCE_JSON_INVALID');
}
