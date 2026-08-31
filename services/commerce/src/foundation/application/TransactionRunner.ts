import type { Transaction, TransactionContext, UnitOfWork } from '../persistence/UnitOfWork';

export class TransactionRunner {
  constructor(private readonly unit: UnitOfWork) {}

  run<T>(context: TransactionContext, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.unit.execute(context, operation);
  }
}
