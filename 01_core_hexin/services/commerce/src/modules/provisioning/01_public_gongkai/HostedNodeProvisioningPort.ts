import {
  parseHostedNodeProvisioningRequest,
  parseHostedNodeProvisioningResult,
  type HostedNodeProvisioningRequest,
  type HostedNodeProvisioningResult,
} from '@shop/config/sfl-node-kernel';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export class HostedNodeProvisioningPort {
  async provision(database: OperationDatabase, input: HostedNodeProvisioningRequest): Promise<HostedNodeProvisioningResult> {
    const request = parseHostedNodeProvisioningRequest(input);
    const result = await database.query<Record<string, unknown>>(
      'select * from organization.provision_hosted_node($1::jsonb)',
      [JSON.stringify(request)],
    );
    const row = result.rows[0];
    if (!row) throw new Error('SFL_HOSTED_NODE_PROVISIONING_FAILED');
    return parseHostedNodeProvisioningResult(row);
  }
}

export const hostedNodeProvisioningPort = new HostedNodeProvisioningPort();
