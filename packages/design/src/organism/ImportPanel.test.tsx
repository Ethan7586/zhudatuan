// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportPanel } from './ImportPanel';

describe('ImportPanel', () => {
  it('announces one current step and keeps the supplied content', () => {
    render(
      <ImportPanel steps={['上传', '预检', '执行']} current={2} label="导入步骤">
        <p>服务端预检结果</p>
      </ImportPanel>
    );
    expect(screen.getByRole('list', { name: '导入步骤' }).querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(screen.getByText('服务端预检结果')).toBeTruthy();
  });
});
