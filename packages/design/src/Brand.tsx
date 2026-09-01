import type { ReactElement } from 'react';

const assets = Object.freeze({
  lockup: new URL('./brand/brand-lockup-horizontal.svg', import.meta.url).href,
  mark: new URL('./brand/brand-mark.svg', import.meta.url).href,
});

export interface BrandProps {
  readonly variant?: keyof typeof assets;
  readonly product?: string;
  readonly inverse?: boolean;
}

export function Brand({ variant = 'lockup', product, inverse = false }: BrandProps): ReactElement<{ readonly className: string }> {
  const accessibleName = product === undefined ? (variant === 'lockup' ? '主打团 ZHUDATUAN 企业福利商城' : '主打团 ZHUDATUAN') : '';
  return (
    <span className={`swbrand swbrand-${variant}${inverse ? ' swbrand-inverse' : ''}`}>
      <img src={assets[variant]} alt={accessibleName} />
      {product === undefined ? null : (
        <span className="swbrandcopy">
          <strong>主打团 ZHUDATUAN</strong>
          <small>{product}</small>
        </span>
      )}
    </span>
  );
}
