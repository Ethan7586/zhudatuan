import type { RefObject } from 'react';

export function CodeField({
  id,
  value,
  busy,
  invalid = false,
  errorId,
  inputRef,
  onChange,
}: Readonly<{ id?: string; value: string; busy: boolean; invalid?: boolean; errorId?: string; inputRef?: RefObject<HTMLInputElement | null>; onChange: (value: string) => void }>) {
  return (
    <input
      ref={inputRef}
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="6 位验证码"
      className="authinput authcode"
      disabled={busy}
      aria-label="短信验证码"
      aria-invalid={invalid || undefined}
      aria-errormessage={errorId}
    />
  );
}
