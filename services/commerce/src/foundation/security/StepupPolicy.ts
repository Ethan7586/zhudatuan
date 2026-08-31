import { freshStepup } from '@shop/authz';

export class StepupPolicy {
  constructor(private readonly maximumAgeSeconds = 900) {}

  accepts(required: boolean, assurance: Readonly<{ level: number; verified?: Date }>, now: Date): boolean {
    if (!required) return true;
    if (assurance.level < 3 || assurance.verified === undefined) return false;
    return freshStepup({ now, stepupAt: assurance.verified, stepupSeconds: this.maximumAgeSeconds });
  }
}
