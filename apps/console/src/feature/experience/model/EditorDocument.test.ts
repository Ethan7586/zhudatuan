import { EXPERIENCE_COMPONENTS, parseExperience } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { componentCatalog } from './ComponentCatalog';
import { addBlock, addPage, changeTheme, moveBlock, patchBlockContent, patchPage, removeBlock, removePage } from './EditorDocument';
import { createExperienceDocument } from './ExperiencePolicy';
import { themePresets } from './ThemePreset';

describe('experience editor document', () => {
  it('registers every and only server-controlled component with valid defaults', () => {
    let document = createExperienceDocument('application:one', '福利首页', '欢迎选购');
    for (const component of componentCatalog) document = addBlock(document, 0, component.type, `block:${component.type}`);
    expect(componentCatalog.map(({ type }) => type)).toEqual(EXPERIENCE_COMPONENTS);
    expect(parseExperience(document).pages[0]?.blocks.map(({ component }) => component)).toEqual(['hero', 'notice', ...EXPERIENCE_COMPONENTS]);
  });

  it('edits page and component trees immutably without orphaning navigation', () => {
    const source = createExperienceDocument('application:one', '福利首页', '欢迎选购');
    const withPage = addPage(source, 'page:two');
    const named = patchPage(withPage, 1, { label: '品牌故事', path: 'brand/story' });
    const withBlock = addBlock(named, 1, 'richtext', 'block:story');
    const edited = patchBlockContent(withBlock, 1, 0, { title: '关于我们', content: '用心提供企业福利。' });
    expect(source.pages).toHaveLength(1);
    expect(parseExperience(edited)).toMatchObject({ navigation: [{ label: '首页' }, { label: '品牌故事', page: 'page:two' }], pages: [{ path: 'home' }, { path: 'brand/story', blocks: [{ component: 'richtext' }] }] });
    expect(removePage(edited, 1).navigation).toHaveLength(1);
    expect(removePage(source, 0)).toBe(source);
  });

  it('moves and removes blocks while applying all three themes to one schema', () => {
    const source = createExperienceDocument('application:one', '福利首页', '欢迎选购');
    const added = addBlock(source, 0, 'richtext', 'block:story');
    expect(moveBlock(added, 0, 2, -1).pages[0]?.blocks.map(({ id }) => id)).toEqual([source.pages[0]?.blocks[0]?.id, 'block:story', source.pages[0]?.blocks[1]?.id]);
    expect(removeBlock(added, 0, 1).pages[0]?.blocks).toHaveLength(2);
    expect(new Set(themePresets.map(({ visual }) => `${visual.surface}:${visual.radius}:${visual.headingFont}:${visual.sectionGap}`))).toHaveLength(3);
    for (const preset of ['shop', 'market', 'governance'] as const) {
      const themed = parseExperience(changeTheme(source, preset));
      expect(themed.theme.preset).toBe(preset);
      expect(themed.pages).toEqual(source.pages);
      expect(themed.navigation).toEqual(source.navigation);
    }
  });
});
