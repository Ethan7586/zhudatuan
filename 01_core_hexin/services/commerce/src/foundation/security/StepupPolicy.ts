export class StepupPolicy {
  constructor(private readonly maximumAgeSeconds = 900) {}

  accepts(required: boolean, assurance: Readonly<{ level: number; verified?: Date }>, now: Date): boolean {
    if (!required) return true;
    if (assurance.level < 3 || assurance.verified === undefined) return false;
    const age = now.getTime() - assurance.verified.getTime();
    return age >= 0 && age <= this.maximumAgeSeconds * 1_000;
  }
}
