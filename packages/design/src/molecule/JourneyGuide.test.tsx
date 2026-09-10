// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { JourneyGuide } from './JourneyGuide';

afterEach(() => cleanup());

describe('JourneyGuide', () => {
  it('renders an ordered, labelled journey with optional outcome guidance', () => {
    render(
      <JourneyGuide
        eyebrow="安全流程"
        title="三步完成"
        steps={[
          { title: '选择', detail: '选择对象' },
          { title: '确认', detail: '查看影响' },
          { title: '完成', detail: '验证生效' },
        ]}
        footer={<p>提交前不会改变数据。</p>}
      />
    );

    const guide = screen.getByRole('region', { name: '三步完成' });
    expect(guide.querySelectorAll('ol > li')).toHaveLength(3);
    expect(screen.getByText('提交前不会改变数据。')).toBeTruthy();
  });

  it('exposes current and completed journey states without replacing the step order', () => {
    render(
      <JourneyGuide
        eyebrow="上架主流程"
        title="当前：关联商品池"
        steps={[
          { title: '商品资料', detail: '资料已保存。', state: 'complete' },
          { title: '关联商品池', detail: '选择一个商品池。', state: 'current' },
          { title: '商城投放', detail: '完成前一步后继续。', state: 'pending' },
        ]}
      />
    );

    const current = screen.getByText('关联商品池').closest('li');
    expect(current?.getAttribute('aria-current')).toBe('step');
    expect(current?.getAttribute('data-state')).toBe('current');
    expect(screen.getByText('商品资料').closest('li')?.getAttribute('data-state')).toBe('complete');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['✓商品资料资料已保存。', '2关联商品池选择一个商品池。', '3商城投放完成前一步后继续。']);
  });
});
