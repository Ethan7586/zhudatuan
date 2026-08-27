import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { DEEP_LINK_ROUTES } from '../packages/contract/src/DeepLinkContract.ts';
import { EXPERIENCE_ACTIONS, EXPERIENCE_COMPONENTS, EXPERIENCE_VERSION } from '../packages/contract/src/ExperienceContract.ts';

const root = resolve(import.meta.dirname, '..');
const experienceTarget = join(root, 'apps/miniapp/miniprogram/domain/experience.js');
const deepLinkTarget = join(root, 'apps/miniapp/miniprogram/domain/deeplink.js');
const experienceOutput = `// Generated from @shop/contract ExperienceContract. Do not edit.\nconst version = ${EXPERIENCE_VERSION};\nconst actions = Object.freeze(${JSON.stringify(EXPERIENCE_ACTIONS)});\nconst components = Object.freeze(${JSON.stringify(EXPERIENCE_COMPONENTS)});\n\n/** @param {unknown} value @returns {any} */\nfunction parse(value) {\n  if (!record(value) || value.version !== version || typeof value.application !== 'string' || !Array.isArray(value.pages) || value.pages.length === 0) throw new Error('EXPERIENCE_DOCUMENT_INVALID');\n  const paths = new Set();\n  const pages = value.pages.map((page) => {\n    if (!record(page) || typeof page.id !== 'string' || typeof page.path !== 'string' || paths.has(page.path) || !Array.isArray(page.blocks)) throw new Error('EXPERIENCE_PAGE_INVALID');\n    paths.add(page.path);\n    const blocks = page.blocks.map((block) => {\n      if (!record(block) || typeof block.id !== 'string' || !components.includes(block.component) || !record(block.content)) throw new Error('EXPERIENCE_BLOCK_INVALID');\n      if (block.action !== undefined && (!record(block.action) || !actions.includes(block.action.type) || typeof block.action.target !== 'string')) throw new Error('EXPERIENCE_ACTION_INVALID');\n      return Object.freeze({ id: block.id, component: block.component, content: Object.freeze({ ...block.content }), ...(block.action === undefined ? {} : { action: Object.freeze({ ...block.action }) }) });\n    });\n    return Object.freeze({ id: page.id, path: page.path, blocks: Object.freeze(blocks) });\n  });\n  return Object.freeze({ version, application: value.application, pages: Object.freeze(pages) });\n}\n\n/** @param {unknown} value @returns {value is Record<string, any>} */\nfunction record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }\nmodule.exports = { actions, components, parse, version };\n`;
const deepLinkOutput = `// Generated from @shop/contract DeepLinkContract. Do not edit.\nconst routes = Object.freeze(${JSON.stringify(DEEP_LINK_ROUTES)});\n\n/** @param {unknown} value */\nfunction parse(value) {\n  if (typeof value !== 'string') throw new Error('DEEPLINK_INVALID');\n  const match = /^\\/page\\/([a-z]+)\\/index\\?id=([A-Za-z0-9:%._-]{1,255})$/.exec(value);\n  const route = match?.[1]; const id = match?.[2];\n  if (!route || !id || !routes.includes(route)) throw new Error('DEEPLINK_INVALID');\n  return Object.freeze({ route, id, url: \`/page/\${route}/index?id=\${id}\` });\n}\nmodule.exports = { parse, routes };\n`;

if (process.argv.includes('--check')) {
  if (readFileSync(experienceTarget, 'utf8') !== experienceOutput) throw new Error('MINIAPP_CONTRACT_GENERATED_DRIFT');
  if (readFileSync(deepLinkTarget, 'utf8') !== deepLinkOutput) throw new Error('MINIAPP_DEEPLINK_GENERATED_DRIFT');
} else {
  mkdirSync(dirname(experienceTarget), { recursive: true });
  writeFileSync(experienceTarget, experienceOutput, 'utf8');
  writeFileSync(deepLinkTarget, deepLinkOutput, 'utf8');
}
