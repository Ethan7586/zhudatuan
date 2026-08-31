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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const accessibleName = product === undefined ? (variant === 'lockup' ? '智慧翼 Smart Wing 企业福利商城' : '智慧翼 Smart Wing') : '';
  return (
    <span className={`swbrand swbrand-${variant}${inverse ? ' swbrand-inverse' : ''}`}>
      <img src={assets[variant]} alt={accessibleName} />
      {product === undefined ? null : (
        <span className="swbrandcopy">
          <strong>智慧翼 Smart Wing</strong>
          <small>{product}</small>
        </span>
      )}
    </span>
  );
<<<<<<< HEAD
=======
  return <span className={`swbrand swbrand-${variant}${inverse ? ' swbrand-inverse' : ''}`}>
    <img src={assets[variant]} alt={variant === 'lockup' ? '智慧翼 Smart Wing 企业福利商城' : '智慧翼 Smart Wing'} />
    {product === undefined ? null : <span className="swbrandcopy"><strong>智慧翼</strong><small>{product}</small></span>}
  </span>;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
}
