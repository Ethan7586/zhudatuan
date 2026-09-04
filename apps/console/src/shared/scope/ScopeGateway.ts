import type { OperationOutputFor } from '@shop/contract';
import { exactOperationOutput } from '@shop/contract/schema';
import { createFetchOrganization, type OrganizationOperations } from '@shop/sdk/organization';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { collectPages } from '../api/Pager';
import { consoleRequest } from '../api/RequestContext';
import { deepFreeze } from '../model/Immutable';
import type { ScopeCatalog } from './ScopeCatalog';

const ScopePageSchema = exactOperationOutput('OrganizationLayersReadOutput');
type ScopeRow = OperationOutputFor<'organization.layers.read'>['items'][number];

export class ScopeGateway implements ScopeCatalog {
  private readonly operations: OrganizationOperations;

  constructor(baseUrl: string) {
    this.operations = createFetchOrganization(baseUrl);
  }

  async read(context: ConsoleContext, signal?: AbortSignal) {
    const rows = await collectPages<ScopeRow>(async (cursor) => {
      const page = ScopePageSchema.parse(await this.operations.layersRead(
        { query: { limit: 100, ...(cursor === undefined ? {} : { cursor }) } },
        consoleRequest(context.scope, signal, context.session.accessVersion),
      ));
      return { items: page.items, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
    }, 10);
    return deepFreeze(rows.filter((row) => row.status === 'active'));
  }
}
