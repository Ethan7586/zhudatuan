import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { PaymentIdentityPort, PaymentIdentitySubject } from '../../public/PaymentIdentityPort';
export class PgPaymentIdentityPort implements PaymentIdentityPort {
  private readonly transactions = new PgTransactionAccess();
  async subject(context: ReadTransactionContext, principal: string, applicationHash: string): Promise<PaymentIdentitySubject | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      ciphertext: string;
    }>(
      `select identity.id,identity.subject_ciphertext ciphertext from identity.federatedidentity identity
      join identity.provider provider on provider.id=identity.provider_instance_id and provider.status='enabled'
      where identity.principal_id=$1 and provider.type='wechat' and identity.status='active'
      and identity.subject_ciphertext is not null and provider.client_id_hash=decode($2,'hex')
      order by identity.updated_at desc,identity.id desc limit 1`,
      [principal, applicationHash]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
