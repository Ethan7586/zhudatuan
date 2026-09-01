interface InvoiceDatabase {
  query<R extends object = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}

export class InvoicePort {
  async snapshot(database: InvoiceDatabase, profile: string | null, owner: string): Promise<unknown | null> {
    if (profile === null) return null;
    return (
      (
        await database.query(
          `select id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_key_version,
      address_ciphertext,address_key_version,version from invoice.profile where id=$1 and owner_id=$2 and status='active'`,
          [profile, owner]
        )
      ).rows[0] ?? null
    );
  }

  async current(database: InvoiceDatabase, owner: string): Promise<Readonly<{ enabled: boolean; profileId: string | null; title: string | null; taxpayerNumberMasked: string | null; version: number }>> {
    const result = await database.query<{ id: string; title_masked: string; taxid_masked: string; version: number }>(
      `select id,title_masked,taxid_masked,version::float8 version from invoice.profile
      where owner_id=$1 and status='active' order by version desc,id limit 1`,
      [owner]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({ enabled: true, profileId: row.id, title: row.title_masked, taxpayerNumberMasked: row.taxid_masked, version: row.version })
      : Object.freeze({ enabled: false, profileId: null, title: null, taxpayerNumberMasked: null, version: 1 });
  }
}
