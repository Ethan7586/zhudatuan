import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogDimensionPort } from '../../../catalog/public';
import type { ExperienceApplicationLabel, ExperienceDimensionPort } from '../../../experience/public';
import type { MemberReadPort } from '../../../member/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { Metric } from '../../domain/model/Metric';
import { DIMENSION_DEFINITIONS, DIMENSION_PRESETS, dimensionName, hiddenDimensionValue, semanticDimensionValue, type DimensionOption, type DisplayedDimension } from '../../domain/value/DimensionCatalog';

export type PresentedMetric<T extends Metric = Metric> = T & Readonly<{ displayedDimensions: readonly DisplayedDimension[] }>;

export class DimensionReader {
  constructor(
    private readonly organizations: OrganizationReadPort,
    private readonly experience: ExperienceDimensionPort,
    private readonly catalog: CatalogDimensionPort,
    private readonly members: MemberReadPort,
    private readonly partners: CatalogPartnerPort
  ) {}

  async catalogFor(context: ReadTransactionContext, scope: string) {
    const applications = await this.experience.applications(context, scope);
    return Object.freeze({
      definitions: DIMENSION_DEFINITIONS,
      presets: Object.freeze(DIMENSION_PRESETS.map(({ reportDimension: _dimension, ...preset }) => Object.freeze(preset))),
      applications: applicationOptions(applications),
    });
  }

  async present<T extends Metric>(context: ReadTransactionContext, scope: string, rows: readonly T[]): Promise<readonly PresentedMetric<T>[]> {
    if (rows.length === 0) return Object.freeze([]);
    const values = collect(rows);
    // Every port shares the transaction's single PostgreSQL client. Keep reads
    // sequential so the driver does not build an unbounded query queue.
    const organizations = await this.organizations.summaries(context, values.organizations);
    const applications = await this.experience.applications(context, scope, values.applications);
    const catalog = await this.catalog.labels(context, { products: values.products, categories: values.categories });
    const members = await this.members.profiles(context, values.members, scope);
    const stores = await this.partners.names(context, values.stores);
    const labels = {
      organization: new Map(organizations.map(({ id, name }) => [id, name])),
      application: new Map(applications.map(({ id, name }) => [id, name])),
      product: new Map(catalog.filter(({ kind }) => kind === 'product').map(({ id, name }) => [id, name])),
      category: new Map(catalog.filter(({ kind }) => kind === 'category').map(({ id, name }) => [id, name])),
      member: new Map(members.map(({ member, displayName }) => [member, displayName])),
      store: stores,
    };
    return Object.freeze(rows.map((row) => Object.freeze({ ...row, displayedDimensions: displayed(row, labels) })));
  }
}

interface LabelMaps {
  readonly organization: ReadonlyMap<string, string>;
  readonly application: ReadonlyMap<string, string>;
  readonly product: ReadonlyMap<string, string>;
  readonly category: ReadonlyMap<string, string>;
  readonly member: ReadonlyMap<string, string>;
  readonly store: ReadonlyMap<string, string>;
}

function collect(rows: readonly Metric[]): Readonly<{
  organizations: readonly string[];
  applications: readonly string[];
  products: readonly string[];
  categories: readonly string[];
  members: readonly string[];
  stores: readonly string[];
}> {
  const organizations = new Set<string>();
  const applications = new Set<string>();
  const products = new Set<string>();
  const categories = new Set<string>();
  const members = new Set<string>();
  const stores = new Set<string>();
  for (const { dimensions } of rows) {
    for (const [code, value] of Object.entries(dimensions)) {
      if (code === 'mall' || code === 'customer' || code === 'voucherScope') organizations.add(value);
      else if (code === 'application') applications.add(value);
      else if (code === 'product') products.add(value);
      else if (code === 'category') categories.add(value);
      else if (code === 'member') members.add(value);
      else if (code === 'store') stores.add(value);
    }
  }
  return Object.freeze({
    organizations: Object.freeze([...organizations]),
    applications: Object.freeze([...applications]),
    products: Object.freeze([...products]),
    categories: Object.freeze([...categories]),
    members: Object.freeze([...members]),
    stores: Object.freeze([...stores]),
  });
}

function displayed(metric: Metric, labels: LabelMaps): readonly DisplayedDimension[] {
  const codes = [
    ...metric.definition.dimensions,
    ...Object.keys(metric.dimensions)
      .filter((code) => !metric.definition.dimensions.includes(code))
      .sort(),
  ];
  return Object.freeze(
    codes.flatMap((code) => {
      const raw = metric.dimensions[code];
      if (raw === undefined) return [];
      const value = entityDimension(code) ? (entityLabel(code, raw, labels) ?? hiddenDimensionValue(code)) : (semanticDimensionValue(code, raw) ?? hiddenDimensionValue(code));
      return [Object.freeze({ code, name: dimensionName(code), value })];
    })
  );
}

function entityDimension(code: string): boolean {
  return code === 'application' || code === 'product' || code === 'category' || code === 'member' || code === 'mall' || code === 'customer' || code === 'voucherScope' || code === 'store';
}

function entityLabel(code: string, value: string, labels: LabelMaps): string | null {
  if (code === 'application') return labels.application.get(value) ?? null;
  if (code === 'product') return labels.product.get(value) ?? null;
  if (code === 'category') return labels.category.get(value) ?? null;
  if (code === 'member') return labels.member.get(value) ?? null;
  if (code === 'store') return labels.store.get(value) ?? null;
  if (code === 'mall' || code === 'customer' || code === 'voucherScope') return labels.organization.get(value) ?? null;
  return null;
}

function applicationOptions(applications: readonly ExperienceApplicationLabel[]): readonly DimensionOption[] {
  const occurrences = new Map<string, number>();
  for (const { name } of applications) occurrences.set(name, (occurrences.get(name) ?? 0) + 1);
  return Object.freeze(applications.map(({ id, name, mallName }) => Object.freeze({ value: id, label: occurrences.get(name) === 1 ? name : `${name} · ${mallName}` })));
}
