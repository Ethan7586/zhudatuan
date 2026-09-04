import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MallProvisionPort } from '../../public/MallProvisionPort';

interface ProvisionRow {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly public_slug: string;
  readonly brand_name: string;
  readonly domain_mode: 'platform' | 'custom';
  readonly custom_domain: string | null;
  readonly timezone: string;
  readonly currency: string;
  readonly theme_preset: 'shop' | 'market' | 'governance';
  readonly theme_primary_color: string;
  readonly theme_accent_color: string;
  readonly theme_logo_object_ref: string | null;
  readonly theme_favicon_object_ref: string | null;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly version: unknown;
}

export class PgExperienceOrganizationPort implements MallProvisionPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async mall(context: ReadTransactionContext, mall: string, minimumVersion: number) {
    return (await this.malls(context, [mall])).find((candidate) => candidate.id === mall && candidate.version >= minimumVersion) ?? null;
  }

  async malls(context: ReadTransactionContext, malls: readonly string[]) {
    const ids = [...new Set(malls)];
    if (ids.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<ProvisionRow>(
      `select organization.id,organization.name,organization.timezone,organization.status,mall.code,mall.public_slug,mall.brand_name,mall.domain_mode,mall.custom_domain,mall.currency,
        mall.theme_preset,mall.theme_primary_color,mall.theme_accent_color,mall.theme_logo_object_ref,mall.theme_favicon_object_ref,mall.version
       from organization.organization organization join organization.mall mall on mall.id=organization.id
       where organization.id=any($1::text[]) and organization.kind='mall'`,
      [ids]
    );
    const byId = new Map(result.rows.map((row) => [row.id, row]));
    return Object.freeze(
      ids.flatMap((id) => {
        const row = byId.get(id);
        return row
          ? [Object.freeze({
          id: row.id,
          name: row.name,
          code: row.code,
          publicSlug: row.public_slug,
          brandName: row.brand_name,
          domain: row.domain_mode === 'custom' ? Object.freeze({ mode: 'custom' as const, customDomain: required(row.custom_domain) }) : Object.freeze({ mode: 'platform' as const }),
          timezone: row.timezone,
          currency: row.currency,
          theme: Object.freeze({ preset: row.theme_preset, primaryColor: row.theme_primary_color, accentColor: row.theme_accent_color, logoObjectRef: row.theme_logo_object_ref, faviconObjectRef: row.theme_favicon_object_ref }),
          status: row.status,
          version: databaseInteger(row.version),
            })]
          : [];
      })
    );
  }
}

function required(value: string | null): string {
  if (!value) throw new Error('ORGANIZATION_CUSTOM_DOMAIN_MISSING');
  return value;
}
