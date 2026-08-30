import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type {
  BenefitChoice,
  BenefitGateway,
  BenefitRefund,
  BenefitTender,
} from '../benefit/application/port/BenefitPort';

export class PurchaseBenefitGateway implements BenefitGateway {
  constructor(
    private readonly membership: string,
    private readonly session: string,
    private readonly intent: string | null = null,
  ) {}

  async preview(database: OperationDatabase, _member: string, _scope: string, accounts: readonly string[]): Promise<readonly BenefitChoice[]> {
    if (accounts.length === 0) return [];
    return (await database.query<BenefitChoice>(`select id,available_minor::float8 available_minor,version::float8 version,kind
      from benefit.purchase_available($1,$2,$3::text[]) order by id`, [this.membership, this.session, accounts])).rows;
  }

  async reserve(database: OperationDatabase, order: string, member: string, _scope: string,
    tenders: readonly BenefitTender[]): Promise<void> {
    if (tenders.length === 0) return;
    await database.query('select benefit.purchase_reserve($1,$2,$3,$4,$5::text[],$6::bigint[])', [
      this.membership,
      this.session,
      order,
      member,
      tenders.map(({ reference }) => reference),
      tenders.map(({ amountMinor }) => amountMinor),
    ]);
  }

  async consume(database: OperationDatabase, order: string, account: string, amountMinor: number): Promise<void> {
    if (this.intent === null) throw new Error('PURCHASE_PAYMENT_INTENT_CONTEXT_REQUIRED');
    await database.query('select benefit.purchase_consume($1,$2,$3,$4,$5,$6)', [
      this.membership,
      this.session,
      order,
      this.intent,
      account,
      amountMinor,
    ]);
  }

  async refund(_database: OperationDatabase, _input: BenefitRefund): Promise<void> {
    throw new Error('PURCHASE_REFUND_FORBIDDEN');
  }

  async release(_database: OperationDatabase, _order: string): Promise<void> {
    throw new Error('PURCHASE_RECOVERY_FORBIDDEN');
  }
}
