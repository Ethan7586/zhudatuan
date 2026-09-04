import { Id, type IdGenerator } from '@shop/kernel';

export class TestIdGenerator implements IdGenerator {
  private sequence = 0;

  next(prefix: string): Id {
    this.sequence += 1;
    return Id.parse(`${prefix}_${this.sequence.toString(32).toUpperCase().padStart(26, '0')}`);
  }
}
