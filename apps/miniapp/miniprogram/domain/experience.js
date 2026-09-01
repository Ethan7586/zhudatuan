// Generated from @shop/contract ExperienceContract. Do not edit.
const version = 2;
const actions = Object.freeze(["link","product","category","collection","exchangeableproduct","micropage","marketingactivity"]);
const components = Object.freeze(["hero","notice","shortcut","productcollection","richtext"]);

/** @param {unknown} value @returns {any} */
function parse(value) {
  if (!record(value) || value.version !== version || typeof value.application !== 'string' || !Array.isArray(value.pages) || value.pages.length === 0) throw new Error('EXPERIENCE_DOCUMENT_INVALID');
  const paths = new Set();
  const pages = value.pages.map((page) => {
    if (!record(page) || typeof page.id !== 'string' || typeof page.path !== 'string' || paths.has(page.path) || !Array.isArray(page.blocks)) throw new Error('EXPERIENCE_PAGE_INVALID');
    paths.add(page.path);
    const blocks = page.blocks.map((block) => {
      if (!record(block) || typeof block.id !== 'string' || !components.includes(block.component) || !record(block.content)) throw new Error('EXPERIENCE_BLOCK_INVALID');
      if (block.action !== undefined && (!record(block.action) || !actions.includes(block.action.type) || typeof block.action.target !== 'string')) throw new Error('EXPERIENCE_ACTION_INVALID');
      return Object.freeze({ id: block.id, component: block.component, content: Object.freeze({ ...block.content }), ...(block.action === undefined ? {} : { action: Object.freeze({ ...block.action }) }) });
    });
    return Object.freeze({ id: page.id, path: page.path, blocks: Object.freeze(blocks) });
  });
  return Object.freeze({ version, application: value.application, pages: Object.freeze(pages) });
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
module.exports = { actions, components, parse, version };
