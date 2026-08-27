export interface Policy<TInput, TDecision> {
  decide(input: TInput): TDecision;
}
