import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const visuals = YAML.parse(readFileSync(join(repositoryRoot, 'config/visuals.yml'), 'utf8'));
const navigation = YAML.parse(readFileSync(join(repositoryRoot, 'config/navigation.yml'), 'utf8'));
const tokens = JSON.parse(readFileSync(join(repositoryRoot, 'packages/design/src/tokens.json'), 'utf8'));

assert(visuals.version === 2, 'VISUAL_AUTHORITY_VERSION_INVALID');
assert(visuals.authority?.policy?.preserveLayout === true, 'VISUAL_LAYOUT_NOT_LOCKED');
assert(visuals.authority?.policy?.preserveInteraction === true, 'VISUAL_INTERACTION_NOT_LOCKED');
assert(visuals.authority?.policy?.preserveNavigationTitles === true, 'NAVIGATION_TITLES_NOT_LOCKED');
assert(visuals.defaults?.theme === 'light', 'VISUAL_THEME_MISSING');
assert(visuals.defaults?.locale === 'zh-CN', 'VISUAL_LOCALE_MISSING');
assert(visuals.defaults?.data === 'deterministic', 'VISUAL_DATA_NOT_DETERMINISTIC');
assert(JSON.stringify(visuals.breakpoints) === JSON.stringify({ mobile: 0, tablet: 768, desktop: 1200, wide: 1600 }), 'VISUAL_BREAKPOINT_SET_DRIFT');
assert(JSON.stringify(visuals.themes) === JSON.stringify(['shop', 'market', 'governance']), 'VISUAL_THEME_PRESET_DRIFT');
assert(visuals.journeys?.source === 'tests/journey/IdealJourneyCatalog.ts' && visuals.journeys?.count === 44, 'VISUAL_JOURNEY_CATALOG_DRIFT');
assert(tokens.version === '1.2.0', 'DESIGN_TOKEN_VERSION_DRIFT');
assert(tokens.color?.brand?.primary === '#1F5EFF' && tokens.color?.brand?.primaryHover === '#174ED1' && tokens.color?.brand?.dark === '#143A8F', 'DESIGN_BRAND_COLOR_DRIFT');
assert(tokens.color?.dark?.background === '#07182F' && tokens.color?.dark?.surface === '#10294D', 'DESIGN_DARK_COLOR_DRIFT');
assert(tokens.color?.surface?.background === '#F5F7FA' && tokens.color?.surface?.base === '#FFFFFF' && tokens.color?.surface?.subtle === '#F8FAFC', 'DESIGN_SURFACE_COLOR_DRIFT');
assert(tokens.color?.text?.primary === '#172033' && tokens.color?.text?.secondary === '#475569' && tokens.color?.text?.muted === '#5F6F82', 'DESIGN_TEXT_COLOR_DRIFT');
assert(JSON.stringify(tokens.layout?.breakpoints) === JSON.stringify(visuals.breakpoints), 'DESIGN_BREAKPOINT_DRIFT');
assert(tokens.border?.width?.focus === 3 && tokens.control?.minTouchTarget === 44, 'DESIGN_ACCESSIBILITY_TOKEN_DRIFT');
assert(JSON.stringify([tokens.motion?.fastMs, tokens.motion?.standardMs, tokens.motion?.slowMs]) === JSON.stringify([120, 200, 320]), 'DESIGN_MOTION_TOKEN_DRIFT');

const authRoot = join(repositoryRoot, 'apps/auth/src');
const authStyleRoot = join(authRoot, 'style');
const authCss = files(authRoot).filter((file) => file.endsWith('.css'));
assert(authCss.length > 0 && authCss.every((file) => file.startsWith(`${authStyleRoot}/`)), 'AUTH_STYLE_OUTSIDE_OWNER');
const authStyle = authCss.map((file) => readFileSync(file, 'utf8')).join('\n');
assert(!/(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(authStyle), 'AUTH_PRIVATE_COLOR_VALUE');
assert([...authStyle.matchAll(/font-family:\s*([^;]+);/gi)].every((match) => match[1]?.trim().startsWith('var(')), 'AUTH_PRIVATE_FONT_VALUE');
assert((authStyle.match(/^\s*\.authinput\s*\{/gm) ?? []).length === 1, 'AUTH_INPUT_STYLE_DUPLICATE');
assert((authStyle.match(/^\s*\.authfield\s*\{/gm) ?? []).length === 1, 'AUTH_FIELD_STYLE_DUPLICATE');
assert(authStyle.includes('@media (prefers-reduced-motion: reduce)'), 'AUTH_REDUCED_MOTION_MISSING');

const expectedViewports = {
  desktop1920: [1920, 1080],
  desktop1440: [1440, 900],
  desktop1366: [1366, 768],
  tabletlandscape: [1024, 768],
  tabletportrait: [768, 1024],
  mobile390: [390, 844],
  mobile375: [375, 812],
  mobile360: [360, 800],
};
assert(JSON.stringify(Object.keys(visuals.viewports)) === JSON.stringify(Object.keys(expectedViewports)), 'VISUAL_VIEWPORT_SET_DRIFT');
for (const [name, [width, height]] of Object.entries(expectedViewports)) {
  assert(visuals.viewports[name]?.width === width && visuals.viewports[name]?.height === height, `VISUAL_VIEWPORT_DRIFT:${name}`);
}

const expectedStates = ['loading', 'empty', 'error', 'forbidden', 'expired', 'partial', 'success'];
const expectedResourceStates = ['loading', 'refreshing', 'empty', 'error', 'forbidden', 'expired', 'unavailable', 'notconfigured', 'notfound', 'conflict', 'offline', 'running', 'partial', 'success'];
const expectedInteractions = ['hover', 'focus', 'selected', 'disabled', 'submitting', 'success'];
assert(JSON.stringify(visuals.states) === JSON.stringify(expectedStates), 'VISUAL_STATE_SET_DRIFT');
assert(JSON.stringify(visuals.resourceStates) === JSON.stringify(expectedResourceStates), 'VISUAL_RESOURCE_STATE_SET_DRIFT');
assert(JSON.stringify(visuals.interactions) === JSON.stringify(expectedInteractions), 'VISUAL_INTERACTION_SET_DRIFT');
assert(visuals.accessibility?.keyboard === 'complete', 'VISUAL_KEYBOARD_CONTRACT_MISSING');
assert(visuals.accessibility?.focusVisible === 'required', 'VISUAL_FOCUS_CONTRACT_MISSING');
assert(visuals.accessibility?.screenReaderLabels === 'required', 'VISUAL_ARIA_CONTRACT_MISSING');
assert(visuals.accessibility?.contrast === 'wcagaa', 'VISUAL_CONTRAST_CONTRACT_MISSING');

const surfaces = Object.keys(visuals.surfaces ?? {});
assert(JSON.stringify(surfaces) === JSON.stringify(['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier']), 'VISUAL_SURFACE_SET_DRIFT');
const forbidden = /(?:^|\/)(?:mock|showcase|demo|desktop-1920|laptop-web|device)(?:\/|$)|\[device\]/i;
const routes = [];
for (const [surface, contract] of Object.entries(visuals.surfaces)) {
  assert(Array.isArray(contract.routes) && contract.routes.length > 0, `VISUAL_ROUTE_SET_EMPTY:${surface}`);
  assert(typeof contract.source === 'string' && existsSync(join(repositoryRoot, contract.source)), `VISUAL_SOURCE_MISSING:${surface}`);
  const catalog = routeCatalog(readFileSync(join(repositoryRoot, contract.source), 'utf8'));
  for (const entry of contract.routes) {
    assert(typeof entry.routeid === 'string' && /^[a-z][a-z0-9]*$/.test(entry.routeid), `VISUAL_ROUTE_INVALID:${surface}`);
    const route = catalog.get(entry.routeid);
    assert(typeof route === 'string' && route.startsWith('/'), `VISUAL_ROUTE_NOT_BOUND:${surface}:${entry.routeid}`);
    assert(typeof entry.baseline === 'string' && /^[a-z]+$/.test(entry.baseline), `VISUAL_BASELINE_INVALID:${surface}:${entry.routeid}`);
    assert(!forbidden.test(route), `VISUAL_FORBIDDEN_ROUTE:${surface}:${entry.routeid}`);
    const identity = `${surface}:${entry.routeid}`;
    assert(!routes.includes(identity), `VISUAL_ROUTE_DUPLICATE:${identity}`);
    routes.push(identity);
  }
}

for (const surface of surfaces) {
  const declaredRoutes = [...routeCatalog(readFileSync(join(repositoryRoot, visuals.surfaces[surface].source), 'utf8')).keys()].sort();
  const visualRoutes = visuals.surfaces[surface].routes.map(({ routeid }) => routeid).sort();
  assert(JSON.stringify(visualRoutes) === JSON.stringify(declaredRoutes), `VISUAL_ROUTE_DRIFT:${surface}`);
}
const coveredAuthStates = new Set(visuals.surfaces.auth.routes.flatMap(({ states = [] }) => states));
assert(expectedStates.every((state) => coveredAuthStates.has(state)), 'AUTH_VISUAL_STATE_COVERAGE_MISSING');

const expectedTitles = new Set(flattenStrings(visuals.navigationTitles));
for (const title of [
  '经营驾驶舱',
  '智慧翼中控台',
  '商品治理台',
  '订单管理系统',
  '财务与对账台',
  '築店 · 商城管理',
  '卡券治理台',
  '数据报表',
  '客服中心',
  '渠道管理',
  '分销与返佣',
  '权限中心',
  '成员管理',
  '通知管理',
  '首页',
]) {
  assert(expectedTitles.has(title), `VISUAL_TITLE_AUTHORITY_MISSING:${title}`);
  assert(
    navigation.nodes.some((node) => node.title === title),
    `NAVIGATION_TITLE_NOT_BOUND:${title}`
  );
}
for (const node of navigation.nodes) {
  assert(!forbidden.test(node.route), `NAVIGATION_FORBIDDEN_ROUTE:${node.id}`);
  assert(!/^(?:数据大屏|商品池|平台层)$/.test(node.title), `NAVIGATION_OLD_TITLE:${node.id}:${node.title}`);
}

assert(visuals.tolerance?.pixelRatio === 0.001, 'VISUAL_PIXEL_TOLERANCE_DRIFT');
assert(visuals.tolerance?.textShiftPixels === 1, 'VISUAL_TEXT_TOLERANCE_DRIFT');
console.log(`visual authority verified: surfaces=${surfaces.length} routes=${routes.length} viewports=${Object.keys(expectedViewports).length} resourceStates=${expectedResourceStates.length}`);

function flattenStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenStrings);
  return [];
}

function routeCatalog(source) {
  const block = source.match(/export const ROUTES\s*=\s*([\s\S]*?)\s+as const;/)?.[1];
  assert(typeof block === 'string', 'VISUAL_ROUTE_CATALOG_INVALID');
  return new Map([...block.matchAll(/(?:^|[{,])\s*([a-z][a-z0-9]*):\s*'([^']+)'/g)].map((match) => [match[1], match[2]]));
}

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
