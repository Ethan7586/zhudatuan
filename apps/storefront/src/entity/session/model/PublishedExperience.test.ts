import { describe, expect, it } from 'vitest';
import type { StorefrontBootstrap } from './Bootstrap';
import { experiencePage, experiencePath, publishedExperience } from './PublishedExperience';
import { experienceActionPath } from '../../../shared/navigation/ExperiencePath';

describe('published storefront experience', () => {
  it('strictly parses the immutable publication and resolves only safe page routes', () => {
    const document = publishedExperience(bootstrap());
    expect(document?.theme).toMatchObject({ preset: 'market', primaryColor: '#2457C5', accentColor: '#E67E22' });
    expect(experiencePath('home')).toBe('/');
    expect(experiencePath('pages/autumn')).toBe('/pages/autumn');
    expect(experiencePath('../orders')).toBeNull();
    expect(experiencePage(document, '/pages/autumn')?.id).toBe('page:autumn');
  });

  it('maps typed actions to canonical routes without accepting arbitrary paths', () => {
    const document = publishedExperience(bootstrap())!;
    expect(experienceActionPath(document, { type: 'product', target: 'listing:one' })).toBe('/products/listing%3Aone');
    expect(experienceActionPath(document, { type: 'category', target: 'category:one' })).toBe('/catalog?category=category%3Aone');
    expect(experienceActionPath(document, { type: 'micropage', target: 'page:autumn' })).toBe('/pages/autumn');
    expect(experienceActionPath(document, { type: 'link', target: '/orders' })).toBeNull();
  });

  it('does not invent a theme when the published projection is unavailable', () => {
    const value = bootstrap();
    expect(publishedExperience({ ...value, experience: { ...value.experience, state: 'unavailable', data: null } })).toBeNull();
  });
});

function bootstrap(): StorefrontBootstrap {
  const document = { version: 2 as const, application: 'application:one', theme: { preset: 'market' as const, primaryColor: '#2457C5', accentColor: '#E67E22', logoObjectRef: null, faviconObjectRef: null }, navigation: [{ id: 'nav:home', label: '首页', page: 'page:home' }, { id: 'nav:autumn', label: '秋日专场', page: 'page:autumn' }], assets: [], pages: [{ id: 'page:home', path: 'home', blocks: [{ id: 'hero:home', component: 'hero' as const, content: { title: '员工福利' } }] }, { id: 'page:autumn', path: 'pages/autumn', blocks: [{ id: 'notice:autumn', component: 'notice' as const, content: { text: '秋日关怀专场' } }] }] };
  return { state: 'complete', entry: { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one' }, binding: { application: 'application:one', mall: 'mall:one', pool: 'pool:one', release: 'release:one', version: 'hash:one', tenant: 'tenant:one' }, subject: { principal: 'principal:one', membership: null, member: null }, scope: { id: 'mall:one', kind: 'mall', tenant: 'tenant:one' }, capabilities: { version: 1, values: [] }, navigationVersion: 'navigation:one', identity: { state: 'complete', version: '1', asOf: '2026-09-04T00:00:00.000Z', data: { state: 'anonymous', member: null, membership: null } }, navigation: { state: 'complete', version: '1', asOf: '2026-09-04T00:00:00.000Z', data: [] }, benefit: { state: 'complete', version: '1', asOf: '2026-09-04T00:00:00.000Z', data: null }, orders: { state: 'complete', version: '1', asOf: '2026-09-04T00:00:00.000Z', data: null }, experience: { state: 'complete', version: '1', asOf: '2026-09-04T00:00:00.000Z', data: document } };
}
