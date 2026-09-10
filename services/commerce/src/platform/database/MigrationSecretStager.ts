import { Semaphore } from '@shop/kernel';
import type { PoolClient } from 'pg';
import type { KmsClient } from '../../pipeline/KmsPort';

export interface MigrationSecrets {
  readonly distributorKeyRef: string;
  readonly identityKeyRef: string;
  readonly partnerKeyRef: string;
  readonly voucherKeyRef: string;
}

interface SourceSecret {
  readonly context: Readonly<Record<string, string>>;
  readonly createdAt: Date;
  readonly id: string;
  readonly keyRef: string;
  readonly plaintext: string;
  readonly target: 'distributor' | 'identity' | 'partner' | 'voucher';
  readonly union?: string;
}

export class MigrationSecretStager {
  constructor(
    private readonly kms: KmsClient,
    private readonly secrets: MigrationSecrets
  ) {}

  async stage(client: PoolClient): Promise<void> {
    const sources = await this.sources(client);
    const semaphore = new Semaphore(8);
    const envelopes = await Promise.all(
      sources.map((source) =>
        semaphore.use(async () => ({
          envelope: await this.kms.encrypt('pii', source.keyRef, source.plaintext, source.context),
          source,
          unionToken: source.union === undefined ? null : (await this.kms.encrypt('pii', source.keyRef, source.union, { ...source.context, value: 'union' })).fingerprint,
        }))
      )
    );
    await client.query('begin');
    try {
      for (const { envelope, source, unionToken } of envelopes) {
        if (source.target === 'voucher') {
          await client.query(
            `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
            values($1,$2,$3,$4,$5) on conflict(voucher_id) do update set code_ciphertext=excluded.code_ciphertext,
            code_fingerprint=excluded.code_fingerprint,key_version=excluded.key_version,staged_at=excluded.staged_at`,
            [source.id, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion, source.createdAt]
          );
        } else if (source.target === 'identity') {
          await client.query(
            `insert into runtime.wechatidentitystage(identity_id,subject_ciphertext,subject_token,union_token,key_version,staged_at)
            values($1,$2,$3,$4,$5,$6) on conflict(identity_id) do update set subject_ciphertext=excluded.subject_ciphertext,
            subject_token=excluded.subject_token,union_token=excluded.union_token,key_version=excluded.key_version,staged_at=excluded.staged_at`,
            [source.id, envelope.ciphertext, envelope.fingerprint, unionToken, envelope.keyVersion, source.createdAt]
          );
        } else if (source.target === 'partner') {
          await client.query(
            `insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
            values($1,$2,$3,$4,$5) on conflict(store_id) do update set address_ciphertext=excluded.address_ciphertext,
            address_token=excluded.address_token,key_version=excluded.key_version,staged_at=excluded.staged_at`,
            [source.id, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion, source.createdAt]
          );
        } else {
          await client.query(
            `insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
            values($1,$2,$3,$4,$5) on conflict(distributor_id) do update set contact_ciphertext=excluded.contact_ciphertext,
            contact_token=excluded.contact_token,key_version=excluded.key_version,staged_at=excluded.staged_at`,
            [source.id, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion, source.createdAt]
          );
        }
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  private async sources(client: PoolClient): Promise<SourceSecret[]> {
    const [vouchers, stores, distributors, identities] = await Promise.all([
      client.query<{ id: string; plaintext: string; created_at: Date }>('select id,voucher_code plaintext,created_at from public.vouchers order by id'),
      client.query<{ id: string; plaintext: string; created_at: Date }>('select id,address_text plaintext,created_at from public.stores where address_text is not null order by id'),
      client.query<{ id: string; plaintext: string; created_at: Date }>("select id,contact_json::text plaintext,created_at from public.distributors where contact_json<>'{}'::jsonb order by id"),
      client.query<{ id: string; plaintext: string; union_id: string | null; created_at: Date }>('select id::text id,open_id plaintext,union_id,created_at from public.member_wechat_identities order by id'),
    ]);
    return [
      ...vouchers.rows.map((row) => ({ context: { domain: 'voucher', voucherId: row.id }, createdAt: row.created_at, id: row.id, keyRef: this.secrets.voucherKeyRef, plaintext: row.plaintext, target: 'voucher' as const })),
      ...stores.rows.map((row) => ({ context: { domain: 'partner', storeId: row.id }, createdAt: row.created_at, id: row.id, keyRef: this.secrets.partnerKeyRef, plaintext: row.plaintext, target: 'partner' as const })),
      ...distributors.rows.map((row) => ({ context: { distributorId: row.id, domain: 'channel' }, createdAt: row.created_at, id: row.id, keyRef: this.secrets.distributorKeyRef, plaintext: row.plaintext, target: 'distributor' as const })),
      ...identities.rows.map((row) => ({
        context: { domain: 'identity', identity: row.id },
        createdAt: row.created_at,
        id: row.id,
        keyRef: this.secrets.identityKeyRef,
        plaintext: row.plaintext,
        target: 'identity' as const,
        ...(row.union_id === null ? {} : { union: row.union_id }),
      })),
    ];
  }
}
