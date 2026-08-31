export class ReturnState {
  private constructor(readonly value: string) {}

  static from(value: string): ReturnState {
    if (!value) throw new Error('RETURN_STATE_REQUIRED');
    return new ReturnState(value);
  }

  receive(): string {
    if (!['authorized', 'intransit'].includes(this.value)) throw new Error('RETURN_STATE_CONFLICT');
    return 'received';
  }

  inspect(accepted: boolean): string {
    if (this.value !== 'received') throw new Error('RETURN_STATE_CONFLICT');
    return accepted ? 'accepted' : 'rejected';
  }
}
