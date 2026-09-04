import { describe, expect, it } from 'vitest';
import { SmsCatalog } from './Catalog';

describe('sms notification catalog', () => {
  it('provides one Chinese configuration source and marks credentials as secret', () => {
    expect(SmsCatalog.name).toBe('短信通知');
    expect(SmsCatalog.capabilities).toEqual(['Delivery', 'TemplateMapping', 'OptOut', 'Receipt']);
    expect(SmsCatalog.settings.find(({ key }) => key === 'credentialRef')).toMatchObject({ secret: true });
    expect(SmsCatalog.help).toContain('验证码');
    expect(SmsCatalog.help).toContain('退订');
  });
});
