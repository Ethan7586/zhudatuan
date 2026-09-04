import { useCallback, useRef, useState } from 'react';
import type { Experience } from '../model/Experience';

export function useEntryViewModel() {
  const [record, setRecord] = useState<Experience | null>(null);
  const trigger = useRef('');
  const open = useCallback((next: Experience, triggerKey: string) => {
    trigger.current = triggerKey;
    setRecord(next);
  }, []);
  const close = useCallback(() => {
    const key = trigger.current;
    trigger.current = '';
    setRecord(null);
    requestAnimationFrame(() => restoreFocus(key));
  }, []);
  return Object.freeze({ record, actions: Object.freeze({ open, close }) });
}

function restoreFocus(key: string, attempt = 0): void {
  const target = [...document.querySelectorAll<HTMLButtonElement>('button[data-entry-trigger]')].find((candidate) => candidate.dataset.entryTrigger === key);
  target?.focus({ preventScroll: true });
  if (target !== undefined && document.activeElement !== target && attempt < 5) window.setTimeout(() => restoreFocus(key, attempt + 1), 50);
}

export type EntryViewModel = ReturnType<typeof useEntryViewModel>;
