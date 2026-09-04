import { describe, expect, it } from 'vitest';
import { patchBlockContent, patchTheme } from './EditorDocument';
import { createExperienceDocument } from './ExperiencePolicy';
import { planVersionMerge } from './VersionDifference';

describe('experience version merge planning', () => {
  const base = createExperienceDocument('application:one', '原始标题', '原始公告');

  it('combines independent local and current fields without dropping either edit', () => {
    const local = patchBlockContent(base, 0, 0, { title: '我的标题', subtitle: '企业福利，温暖抵达' });
    const current = patchTheme(base, { accentColor: '#CC5500' });
    const plan = planVersionMerge(base, local, current);
    expect(plan.safe).toBe(true);
    expect(plan.needsSave).toBe(true);
    expect(plan.merged.pages[0]?.blocks[0]?.content.title).toBe('我的标题');
    expect(plan.merged.theme.accentColor).toBe('#CC5500');
    expect(plan.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '第 1 页 · 第 1 个组件 · 标题', overlaps: false }),
        expect.objectContaining({ label: '强调色', overlaps: false }),
      ])
    );
  });

  it('blocks automatic merge when both editors changed the same field', () => {
    const local = patchTheme(base, { primaryColor: '#111111' });
    const current = patchTheme(base, { primaryColor: '#222222' });
    const plan = planVersionMerge(base, local, current);
    expect(plan.safe).toBe(false);
    expect(plan.merged.theme.primaryColor).toBe('#222222');
    expect(plan.differences).toContainEqual(expect.objectContaining({ label: '主品牌色', local: '#111111', current: '#222222', overlaps: true }));
  });

  it('treats concurrent structural edits as overlapping instead of guessing', () => {
    const local = Object.freeze({ ...base, pages: Object.freeze([...base.pages, { id: 'page:local', path: 'local', blocks: Object.freeze([]) }]) });
    const current = Object.freeze({ ...base, pages: Object.freeze([...base.pages, { id: 'page:current', path: 'current', blocks: Object.freeze([]) }]) });
    const plan = planVersionMerge(base, local, current);
    expect(plan.safe).toBe(false);
    expect(plan.differences).toContainEqual(expect.objectContaining({ label: '页面结构与顺序', overlaps: true }));
  });
});
