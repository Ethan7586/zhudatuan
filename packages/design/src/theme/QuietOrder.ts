import type { ExperienceTheme } from './SmartWing';

export const quietOrder = Object.freeze({
  id: 'shop',
  name: '静序',
  temperament: '克制 · 秩序 · 留白',
  description: '适合员工福利、标准商城与高频选购。',
  primary: '#1F5EFF',
  accent: '#19A974',
  surface: '#F7F8FA',
  radius: '12px',
  headingFont: 'var(--sw-font-family)',
  sectionGap: '24px',
} as const satisfies ExperienceTheme);
