import type { IdentityDisplayHint } from '@shop/contract';

export function IdentityBadge({ hint, fallback }: Readonly<{
  hint: IdentityDisplayHint | undefined;
  fallback: string;
}>) {
  if (hint === undefined) return <small>{fallback}</small>;
  return (
    <small data-identity-kind={hint.kind}>
      {hint.label} · <b>{hint.code}</b>
      {hint.maskedMobile === undefined ? null : <> · {hint.maskedMobile}</>}
    </small>
  );
}
