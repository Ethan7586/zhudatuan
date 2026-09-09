// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyGuide } from './JourneyGuide';

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
});
