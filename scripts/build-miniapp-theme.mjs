import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'packages/design/src/tokens.json');
const target = join(root, 'apps/miniapp/miniprogram/styles/tokens.wxss');
const brandSource = join(root, 'packages/design/src/brand/brand-mark.svg');
const brandTarget = join(root, 'apps/miniapp/miniprogram/assets/brandmark.svg');
const wingSource = join(root, 'packages/design/src/brand/wing-code-symbol.svg');
const wingTarget = join(root, 'apps/miniapp/miniprogram/assets/wingcode.svg');
const bindingTarget = join(root, 'apps/miniapp/miniprogram/generated/DesignBinding.ts');
const tokens = JSON.parse(readFileSync(source, 'utf8'));
const visuals = parse(readFileSync(join(root, 'config/visuals.yml'), 'utf8'));
const color = tokens.color;
const rpx = (value) => `${Number(value) * 2}rpx`;
const shadow = ({ x, y, blur, spread = 0, color: value, alpha }) => `${rpx(x)} ${rpx(y)} ${rpx(blur)}${spread === 0 ? '' : ` ${rpx(spread)}`} rgba(${value.join(', ')}, ${alpha})`;
const output = `/* Generated from packages/design/src/tokens.json v${tokens.version}. Do not edit. */
page {
  --shop-brand: ${color.brand.primary};
  --shop-brand-hover: ${color.brand.primaryHover};
  --shop-brand-dark: ${color.brand.dark};
  --shop-brand-ink: ${color.brand.ink};
  --shop-brand-light: ${color.brand.light};
  --shop-background: ${color.surface.background};
  --shop-surface: ${color.surface.base};
  --shop-surface-subtle: ${color.surface.subtle};
  --shop-border: ${color.surface.border};
  --shop-border-strong: ${color.surface.borderStrong};
  --shop-text: ${color.text.primary};
  --shop-text-secondary: ${color.text.secondary};
  --shop-text-muted: ${color.text.muted};
  --shop-text-disabled: ${color.text.disabled};
  --shop-text-inverse: ${color.text.inverse};
  --shop-success: ${color.semantic.successStrong};
  --shop-success-surface: ${color.semantic.successSurface};
  --shop-warning: ${color.semantic.warningStrong};
  --shop-warning-surface: ${color.semantic.warningSurface};
  --shop-danger: ${color.semantic.dangerStrong};
  --shop-danger-surface: ${color.semantic.dangerSurface};
  --shop-price: ${color.commerce.price};
  --shop-promotion: ${color.commerce.promotion};
  --shop-commerce-warm: ${color.commerce.warmSurface};
  --shop-hero-shade-strong: ${color.overlay.heroStrong};
  --shop-hero-shade-soft: ${color.overlay.heroSoft};
  --shop-inverse-border: ${color.overlay.inverseBorder};
  --shop-inverse-tint: ${color.overlay.inverseTint};
  --shop-inverse-label: ${color.overlay.inverseLabel};
  --shop-shadow-card: ${shadow(tokens.elevation.card)};
  --shop-shadow-raised: ${shadow(tokens.elevation.raised)};
  --shop-shadow-hero: ${shadow(tokens.elevation.hero)};
  --shop-shadow-navigation: ${shadow(tokens.elevation.navigation)};
  --shop-radius-small: ${rpx(tokens.radius.small)};
  --shop-radius-medium: ${rpx(tokens.radius.medium)};
  --shop-radius-large: ${rpx(tokens.radius.large)};
  --shop-radius-extra: ${rpx(tokens.radius.extraLarge)};
  --shop-opacity-pressed: ${tokens.opacity.loading};
}
`;
const binding = `// Generated from packages/design/src/tokens.json and config/visuals.yml. Do not edit.
export const MINIAPP_VIEW_STATES = Object.freeze(${JSON.stringify(visuals.states)} as const);
export const MINIAPP_RESOURCE_STATES = Object.freeze(${JSON.stringify(visuals.resourceStates)} as const);
export const MINIAPP_TOKEN = Object.freeze({ brand: '${color.brand.primary}', minimumTouchRpx: ${Number(tokens.control.minTouchTarget) * 2}, version: '${tokens.version}' } as const);
export type MiniappViewState = (typeof MINIAPP_VIEW_STATES)[number];
export type MiniappResourceState = (typeof MINIAPP_RESOURCE_STATES)[number];
`;

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('MINIAPP_THEME_GENERATED_DRIFT');
  if (readFileSync(brandTarget, 'utf8') !== readFileSync(brandSource, 'utf8')) throw new Error('MINIAPP_BRAND_GENERATED_DRIFT');
  if (readFileSync(wingTarget, 'utf8') !== readFileSync(wingSource, 'utf8')) throw new Error('MINIAPP_WING_CODE_GENERATED_DRIFT');
  if (readFileSync(bindingTarget, 'utf8') !== binding) throw new Error('MINIAPP_DESIGN_BINDING_GENERATED_DRIFT');
  console.log('miniapp theme: current');
} else {
  mkdirSync(dirname(target), { recursive: true });
  mkdirSync(dirname(brandTarget), { recursive: true });
  writeFileSync(target, output);
  writeFileSync(brandTarget, readFileSync(brandSource));
  writeFileSync(wingTarget, readFileSync(wingSource));
  writeFileSync(bindingTarget, binding);
  console.log('miniapp theme: generated');
}
