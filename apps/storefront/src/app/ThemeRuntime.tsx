import type { CSSProperties, ReactNode } from 'react';
import type { ExperienceTheme } from '@shop/contract';

type ThemeStyle = CSSProperties & Readonly<Record<'--storefront-primary' | '--storefront-accent', string>>;

export function ThemeRuntime({ theme, children }: Readonly<{ theme: ExperienceTheme | null; children: ReactNode }>) {
  const style: ThemeStyle | undefined = theme ? { '--storefront-primary': theme.primaryColor, '--storefront-accent': theme.accentColor } : undefined;
  return <div className="storefronttheme" data-storefront-theme={theme?.preset ?? 'default'} data-published-theme={theme ? 'true' : 'false'} style={style}>{children}</div>;
}
