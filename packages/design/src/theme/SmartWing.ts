export interface ExperienceTheme {
  readonly id: 'smartwing' | 'shop' | 'market' | 'governance';
  readonly name: string;
  readonly temperament: string;
  readonly description: string;
  readonly primary: `#${string}`;
  readonly accent: `#${string}`;
  readonly surface: `#${string}`;
  readonly radius: `${number}px`;
  readonly headingFont: string;
  readonly sectionGap: `${number}px`;
}

export const smartWing = Object.freeze({
  id: 'smartwing',
  name: '智慧翼',
  temperament: '清晰 · 可信 · 高效',
  description: '六端共享的基础工作界面，不改变业务交互语义。',
  primary: '#1F5EFF',
  accent: '#143A8F',
  surface: '#F5F7FA',
  radius: '12px',
  headingFont: "Inter, 'PingFang SC', 'Noto Sans SC', sans-serif",
  sectionGap: '24px',
} as const satisfies ExperienceTheme);
