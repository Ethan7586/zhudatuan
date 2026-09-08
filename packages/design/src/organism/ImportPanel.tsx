import type { ReactNode } from 'react';
import './ImportPanel.css';

export interface ImportPanelProps {
  readonly steps: readonly string[];
  readonly current: number;
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly stepsClassName?: string;
}

export function ImportPanel({ steps, current, label, children, className, stepsClassName }: Readonly<ImportPanelProps>) {
  if (steps.length < 2 || !Number.isSafeInteger(current) || current < 1 || current > steps.length) throw new Error('IMPORT_PANEL_STATE_INVALID');
  return (
    <section className={classes('shopimportpanel', className)} data-step={current}>
      <ol className={classes('shopimportsteps', stepsClassName)} aria-label={label}>
        {steps.map((step, index) => (
          <li key={step} className={index + 1 === current ? 'isactive' : index + 1 < current ? 'iscomplete' : undefined} aria-current={index + 1 === current ? 'step' : undefined}>
            <span aria-hidden="true">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      {children}
    </section>
  );
}

function classes(...values: readonly (string | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
