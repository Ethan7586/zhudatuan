import React from 'react';
import { Check, Plus } from 'lucide-react';
import { beginCartInteraction, recordCartInteraction } from '../../context/cartInteractionTelemetry';

interface InstantCartAddButtonProps {
  ariaLabel: string;
  className: string;
  listingId: string;
  onAdd: () => boolean | void;
  label?: string;
  addedLabel?: string;
  disabled?: boolean;
}

export const InstantCartAddButton = React.memo(function InstantCartAddButton({
  addedLabel = '已加入',
  ariaLabel,
  className,
  disabled = false,
  label,
  listingId,
  onAdd,
}: Readonly<InstantCartAddButtonProps>) {
  const [added, setAdded] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionId = React.useRef<string | null>(null);

  React.useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handlePointerDown = () => {
    if (disabled) return;
    interactionId.current = beginCartInteraction(listingId);
    requestAnimationFrame(() => recordCartInteraction('button-feedback-frame', listingId, interactionId.current ?? undefined));
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled || onAdd() === false) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setAdded(true);
    resetTimer.current = setTimeout(() => setAdded(false), 620);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      data-cart-add-state={added ? 'added' : 'idle'}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={`relative isolate touch-manipulation transform-gpu overflow-hidden transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.91] motion-reduce:transform-none motion-reduce:transition-none ${className}`}
    >
      <span className={`flex items-center justify-center gap-1 transition-[opacity,transform] duration-150 motion-reduce:transition-none ${added ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`}>
        <Plus className={label ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} aria-hidden="true" />
        {label ? <span>{label}</span> : null}
      </span>
      <span className={`absolute inset-0 flex items-center justify-center gap-1 text-white transition-[opacity,transform] duration-150 motion-reduce:transition-none ${added ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} aria-hidden="true">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {label ? <span>{addedLabel}</span> : null}
      </span>
      <span className="sr-only" aria-live="polite">{added ? addedLabel : ''}</span>
    </button>
  );
});
