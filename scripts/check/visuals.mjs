import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const visuals = YAML.parse(readFileSync(join(repositoryRoot, 'config/visuals.yml'), 'utf8'));
const navigation = YAML.parse(readFileSync(join(repositoryRoot, 'config/navigation.yml'), 'utf8'));

assert(visuals.version === 2, 'VISUAL_AUTHORITY_VERSION_INVALID');
assert(visuals.authority?.policy?.preserveLayout === true, 'VISUAL_LAYOUT_NOT_LOCKED');
assert(visuals.authority?.policy?.preserveInteraction === true, 'VISUAL_INTERACTION_NOT_LOCKED');
assert(visuals.authority?.policy?.preserveNavigationTitles === true, 'NAVIGATION_TITLES_NOT_LOCKED');
assert(visuals.defaults?.theme === 'light', 'VISUAL_THEME_MISSING');
assert(visuals.defaults?.locale === 'zh-CN', 'VISUAL_LOCALE_MISSING');
assert(visuals.defaults?.data === 'deterministic', 'VISUAL_DATA_NOT_DETERMINISTIC');

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

const expectedStates = ['loading', 'empty', 'error', 'denied', 'expired', 'partial', 'success'];
const expectedInteractions = ['hover', 'focus', 'selected', 'disabled', 'submitting', 'success'];
assert(JSON.stringify(visuals.states) === JSON.stringify(expectedStates), 'VISUAL_STATE_SET_DRIFT');
assert(JSON.stringify(visuals.interactions) === JSON.stringify(expectedInteractions), 'VISUAL_INTERACTION_SET_DRIFT');
assert(visuals.accessibility?.keyboard === 'complete', 'VISUAL_KEYBOARD_CONTRACT_MISSING');
assert(visuals.accessibility?.focusVisible === 'required', 'VISUAL_FOCUS_CONTRACT_MISSING');
assert(visuals.accessibility?.screenReaderLabels === 'required', 'VISUAL_ARIA_CONTRACT_MISSING');
assert(visuals.accessibility?.contrast === 'wcagaa', 'VISUAL_CONTRAST_CONTRACT_MISSING');

const surfaces = Object.keys(visuals.surfaces ?? {});
assert(JSON.stringify(surfaces) === JSON.stringify(['auth', 'console', 'storefront']), 'VISUAL_SURFACE_SET_DRIFT');
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

const declaredAuthRoutes = [...routeCatalog(readFileSync(join(repositoryRoot, visuals.surfaces.auth.source), 'utf8')).keys()].sort();
const visualAuthRoutes = visuals.surfaces.auth.routes.map(({ routeid }) => routeid).sort();
assert(JSON.stringify(visualAuthRoutes) === JSON.stringify(declaredAuthRoutes), 'AUTH_VISUAL_ROUTE_DRIFT');
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
  '客服系统',
  '渠道接入系统',
  '分销返佣系统',
  '会员与权限',
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
console.log(`visual authority verified: surfaces=${surfaces.length} routes=${routes.length} viewports=${Object.keys(expectedViewports).length}`);

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

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
