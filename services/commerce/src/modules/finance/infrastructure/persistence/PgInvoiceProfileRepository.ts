import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

export class PgInvoiceProfileRepository {
  constructor(private readonly database: SqlExecutor) {}

  manage(input: Readonly<{
    id: string;
    ownerId: string;
    title: Readonly<{ ciphertext: string; keyVersion: string }>;
    taxid: Readonly<{ ciphertext: string; fingerprint: string; keyVersion: string }>;
    address: Readonly<{ ciphertext: string; keyVersion: string }> | null;
    titleMasked: string;
    taxidMasked: string;
    expectedVersion: number | null;
  }>) {
    return this.database.query(
      `insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
      taxid_key_version,address_ciphertext,address_key_version,title_masked,taxid_masked,status,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',1) on conflict(id) do update set
      title_ciphertext=excluded.title_ciphertext,title_key_version=excluded.title_key_version,taxid_ciphertext=excluded.taxid_ciphertext,
      taxid_token=excluded.taxid_token,taxid_key_version=excluded.taxid_key_version,address_ciphertext=excluded.address_ciphertext,
      address_key_version=excluded.address_key_version,title_masked=excluded.title_masked,taxid_masked=excluded.taxid_masked,
      version=invoice.profile.version+1 where invoice.profile.owner_id=$2
      and ($12::bigint is null or invoice.profile.version=$12) returning id,owner_id,status,version`,
      [input.id, input.ownerId, input.title.ciphertext, input.title.keyVersion, input.taxid.ciphertext, input.taxid.fingerprint,
        input.taxid.keyVersion, input.address?.ciphertext ?? null, input.address?.keyVersion ?? null, input.titleMasked,
        input.taxidMasked, input.expectedVersion]
    );
  }
}
