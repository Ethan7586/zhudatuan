import type { ExperienceTheme } from './SmartWing';

export const warmWorkshop = Object.freeze({
  id: 'governance',
  name: '暖筑工坊',
  temperament: '温暖 · 模块 · 亲和',
  description: '适合政企关怀、工会福利与长期运营。',
  primary: '#E8502A',
  accent: '#F2A65A',
  surface: '#FFF7ED',
  radius: '18px',
  headingFont: 'var(--sw-font-family)',
  sectionGap: '20px',
} as const satisfies ExperienceTheme);
