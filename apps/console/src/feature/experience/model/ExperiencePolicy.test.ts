import { describe, expect, it } from 'vitest';
import type { ExperienceDocument } from './Experience';
import { createExperienceDocument } from './ExperiencePolicy';

describe('experience document revision', () => {
  it('changes editable copy without discarding theme, extra blocks or pages', () => {
    const source: ExperienceDocument = {
      version: 2,
      application: 'application:one',
      theme: { preset: 'governance', primaryColor: '#E8502A', accentColor: '#F2A65A', logoObjectRef: 'object:logo', faviconObjectRef: null },
      navigation: [{ id: 'nav:home', label: '首页', page: 'home' }],
      assets: ['object:hero'],
      pages: [
        {
          id: 'home',
          path: 'home',
          blocks: [
            { id: 'hero', component: 'hero', content: { title: '旧标题', image: 'object:hero' } },
            { id: 'collection', component: 'productcollection', content: { pool: 'pool:one' } },
          ],
        },
        { id: 'about', path: 'about', blocks: [{ id: 'rich', component: 'richtext', content: { text: '品牌故事' } }] },
      ],
    };
    const revised = createExperienceDocument('application:one', '新标题', '新公告', source);
    expect(revised.theme).toEqual(source.theme);
    expect(revised.navigation).toEqual(source.navigation);
    expect(revised.assets).toEqual(source.assets);
    expect(revised.pages).toHaveLength(2);
    expect(revised.pages[0]?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'hero', content: expect.objectContaining({ title: '新标题', image: 'object:hero' }) }),
        expect.objectContaining({ id: 'collection' }),
        expect.objectContaining({ component: 'notice', content: { announcement: '新公告' } }),
      ])
    );
    expect(revised.pages[1]).toEqual(source.pages[1]);
  });
});
