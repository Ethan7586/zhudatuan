import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MasterDetail, MasterItem } from './MasterDetail';
import { MetricCard, MetricGrid } from './WorkspaceMetrics';
import { WorkspaceHero } from './WorkspaceHero';

function propsOf<T>(value: unknown): T {
  if (!isValidElement<T>(value)) throw new Error('WORKSPACE_FOUNDATION_ELEMENT_REQUIRED');
  return value.props;
}

describe('VI 1.2 workspace foundations', () => {
  it('keeps hero identity, content and actions as optional composition slots', () => {
    const hero = propsOf<{ className: string; children: unknown }>(WorkspaceHero({ identity: '品牌', eyebrow: 'SMART WING', title: '权限中心', description: '角色与作用域', actions: '创建角色' }));
    expect(hero.className).toContain('swworkspacehero');
    expect(Children.count(hero.children)).toBe(3);
  });

  it('exposes metric grid density and semantic tone without business coupling', () => {
    const grid = propsOf<{ 'data-columns': string; role: string }>(MetricGrid({ columns: 'three', children: '指标' }));
    const metric = propsOf<{ 'data-tone': string; role: string }>(MetricCard({ label: '活跃成员', value: '128', tone: 'success' }));
    expect(grid['data-columns']).toBe('three');
    expect(grid.role).toBe('list');
    expect(metric['data-tone']).toBe('success');
    expect(metric.role).toBe('listitem');
  });

  it('provides labelled master/detail regions and a real disabled selection item', () => {
    const layout = propsOf<{ className: string; children: ReactNode }>(MasterDetail({ masterLabel: '角色列表', detailLabel: '角色详情', master: '列表', detail: '详情' }));
    const [master, detail] = Children.toArray(layout.children);
    expect(propsOf<{ 'aria-label': string }>(master)['aria-label']).toBe('角色列表');
    expect(propsOf<{ 'aria-label': string }>(detail)['aria-label']).toBe('角色详情');

    const item = propsOf<{ 'aria-current': string; 'data-selected': boolean; disabled: boolean; type: string }>(MasterItem({ title: '平台 Owner', selected: true, disabled: true }));
    expect(item['aria-current']).toBe('true');
    expect(item['data-selected']).toBe(true);
    expect(item.disabled).toBe(true);
    expect(item.type).toBe('button');
  });
});
