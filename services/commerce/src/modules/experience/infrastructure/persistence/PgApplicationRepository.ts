import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { MallProvisionPort, OrganizationReadPort } from '../../../organization/public';
import type { ApplicationRepository } from '../../application/port/ApplicationRepository';
import type { StorefrontConfig } from '../../application/port/StorefrontConfig';
import { PgApplicationReader } from './PgApplicationReader';
import { PgApplicationWriter } from './PgApplicationWriter';

export class PgApplicationRepository implements ApplicationRepository {
  private readonly reader: PgApplicationReader;
  private readonly writer: PgApplicationWriter;

  constructor(transactions: PgTransactionAccess, organizations: OrganizationReadPort, malls: MallProvisionPort, catalog: ExperienceCatalogPort, storefront: StorefrontConfig) {
    this.reader = new PgApplicationReader(transactions, organizations, malls, storefront);
    this.writer = new PgApplicationWriter(transactions, malls, catalog, this.reader);
  }

  create: ApplicationRepository['create'] = (context, input) => this.writer.create(context, input);
  copy: ApplicationRepository['copy'] = (context, input) => this.writer.copy(context, input);
  readSummaries: ApplicationRepository['readSummaries'] = (context, input) => this.reader.readSummaries(context, input);
  detail: ApplicationRepository['detail'] = (context, input) => this.reader.detail(context, input);
  update: ApplicationRepository['update'] = (context, input) => this.writer.update(context, input);
}
