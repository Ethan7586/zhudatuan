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
export interface ExperienceDocument {
  readonly version: typeof EXPERIENCE_VERSION;
  readonly application: string;
  readonly pages: readonly ExperiencePage[];
}

export function parseExperience(value: unknown): ExperienceDocument {
  const source = objectValue(value);
  if (source.version !== EXPERIENCE_VERSION) throw new Error('EXPERIENCE_VERSION_INVALID');
  const application = required(source.application, 'EXPERIENCE_APPLICATION_INVALID');
  if (!Array.isArray(source.pages) || source.pages.length === 0 || source.pages.length > 100) throw new Error('EXPERIENCE_PAGES_INVALID');
  const pages = source.pages.map((page) => parsePage(page));
  if (new Set(pages.map((page) => page.path)).size !== pages.length) throw new Error('EXPERIENCE_PAGE_PATH_DUPLICATE');
  return Object.freeze({ version: EXPERIENCE_VERSION, application, pages: Object.freeze(pages) });
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
  return Object.freeze({ id: required(source.id, 'EXPERIENCE_BLOCK_ID_INVALID'), component: component as ExperienceComponentType, content: objectValue(source.content), ...(action === undefined ? {} : { action }) });
}

function parseAction(value: unknown): ExperienceAction {
  const source = objectValue(value);
  if (!EXPERIENCE_ACTIONS.includes(source.type as ExperienceActionType)) throw new Error('EXPERIENCE_ACTION_INVALID');
  return Object.freeze({ type: source.type as ExperienceActionType, target: required(source.target, 'EXPERIENCE_ACTION_TARGET_INVALID') });
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
