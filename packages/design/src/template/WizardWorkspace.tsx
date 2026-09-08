import type { ReactNode } from 'react';
import './Templates.css';

export function WizardWorkspace({ title, step, steps, children, actions }: Readonly<{ title: string; step: number; steps: readonly string[]; children: ReactNode; actions: ReactNode }>) {
  if (!Number.isSafeInteger(step) || step < 1 || step > steps.length) throw new Error('WIZARD_STEP_INVALID');
  return <main className="shopworkspace" data-template="wizard"><header><div><p>第 {step} 步，共 {steps.length} 步</p><h1>{title}</h1></div></header><ol className="shopwizardsteps" aria-label="办理步骤">{steps.map((label, index) => <li key={label} aria-current={index + 1 === step ? 'step' : undefined} data-complete={index + 1 < step ? true : undefined}>{label}</li>)}</ol><section>{children}</section><footer>{actions}</footer></main>;
}
