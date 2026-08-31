import { createContext, useContext, type ReactNode } from 'react';

export interface StepupController {
  readonly request: () => void;
}

const StepupContext = createContext<StepupController | null>(null);

export function StepupProvider({ controller, children }: Readonly<{ controller: StepupController; children: ReactNode }>) {
  return <StepupContext value={controller}>{children}</StepupContext>;
}

export function useStepup(): StepupController {
  const controller = useContext(StepupContext);
  if (controller === null) throw new Error('STEPUP_PROVIDER_REQUIRED');
  return controller;
}
