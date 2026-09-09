import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, settingsSectionForRoute } from './SettingsSection';

describe('settings navigation sections', () => {
  it('uses the generated route groups as the only categorization authority', () => {
    expect(SETTINGS_SECTIONS.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'organization', title: '组织与人员' },
      { id: 'resources', title: '业务资源' },
      { id: 'connections', title: '连接' },
      { id: 'security', title: '安全' },
      { id: 'system', title: '系统' },
    ]);
    expect(settingsSectionForRoute('consoleaccess')?.title).toBe('组织与人员');
    expect(settingsSectionForRoute('consolequalification')?.title).toBe('业务资源');
    expect(settingsSectionForRoute('consolechannels')?.title).toBe('连接');
    expect(settingsSectionForRoute('consolerisk')?.title).toBe('安全');
    expect(settingsSectionForRoute('consolecontrol')?.title).toBe('系统');
    expect(settingsSectionForRoute('consolereferral')).toBeNull();
  });
});
