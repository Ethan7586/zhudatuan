import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { Button, IconButton } from './Button';
import { Divider } from './Divider';
import { Icon } from './Icon';
import { Surface } from './Surface';

function propsOf<T>(value: unknown): T {
  if (!isValidElement<T>(value)) throw new Error('DESIGN_PRIMITIVE_ELEMENT_REQUIRED');
  return value.props;
}

describe('VI 1.1 design primitives', () => {
  it('maps button tone, size and icon-only semantics to stable classes', () => {
    const defaultButton = propsOf<{ className: string }>(Button({ children: '取消' }));
    expect(defaultButton.className.match(/shopbuttondefault/g)).toHaveLength(1);

    const button = propsOf<{ className: string }>(Button({ tone: 'primary', size: 'large', children: '保存' }));
    expect(button.className).toContain('shopbuttonprimary');
    expect(button.className).toContain('shopbuttonlarge');

    const iconButton = propsOf<{ children: readonly unknown[] }>(IconButton({ label: '刷新', children: '↻' }));
    expect(iconButton.children).toHaveLength(2);
  });

  it('exposes depth, divider, icon and badge contracts through data attributes', () => {
    expect(propsOf<{ 'data-depth': string }>(Surface({ depth: 'raised', children: '卡片' }))['data-depth']).toBe('raised');
    expect(propsOf<{ 'data-orientation': string }>(Divider({ orientation: 'vertical' }))['data-orientation']).toBe('vertical');
    expect(propsOf<{ role: string; 'aria-label': string }>(Icon({ label: '权限', children: 'icon' })).role).toBe('img');
    expect(propsOf<{ 'data-tone': string }>(Badge({ tone: 'success', children: '正常' }))['data-tone']).toBe('success');
  });
});
