import { parseAuthoritativeNodeContext, parseNodeScopeRecord, type AuthoritativeNodeContext, type NodeScopeRecord } from '@shop/config/sfl-node-kernel';
import type { DatabasePool } from '../persistence/Pool';

interface NodeContextRow extends Record<string, unknown> {}
interface NodeScopeRow extends Record<string, unknown> {}

export class PgAuthoritativeNodeContextResolver {
  constructor(private readonly pool: DatabasePool) {}

  async resolve(targetNodeId: string): Promise<AuthoritativeNodeContext> {
    const result = await this.pool.query<NodeContextRow>('select * from organization.resolve_node_context($1)', [targetNodeId]);
    const row = result.rows[0];
    if (!row || result.rows.length !== 1) throw new Error('SFL_NODE_CONTEXT_UNRESOLVED');
    return parseAuthoritativeNodeContext(row);
  }
}

export class PgNodeScopeResolver {
  constructor(private readonly pool: DatabasePool) {}

  async self(context: AuthoritativeNodeContext): Promise<readonly NodeScopeRecord[]> {
    return this.resolveIndexed('organization.resolve_node_scope_self', context);
  }

  async ancestors(context: AuthoritativeNodeContext): Promise<readonly NodeScopeRecord[]> {
    return this.resolveIndexed('organization.resolve_node_scope_ancestors', context);
  }

  async descendants(context: AuthoritativeNodeContext): Promise<readonly NodeScopeRecord[]> {
    return this.resolveIndexed('organization.resolve_node_scope_descendants', context);
  }

  async subtree(context: AuthoritativeNodeContext): Promise<readonly NodeScopeRecord[]> {
    return this.resolveIndexed('organization.resolve_node_scope_subtree', context);
  }

  private async resolveIndexed(databaseFunction: string, context: AuthoritativeNodeContext): Promise<readonly NodeScopeRecord[]> {
    const result = await this.pool.query<NodeScopeRow>(`select * from ${databaseFunction}($1,$2)`, [context.line_id, context.node_id]);
    const scope = result.rows.map(parseNodeScopeRecord);
    if (scope.some((record) => record.line_id !== context.line_id)) {
      throw new Error('SFL_NODE_SCOPE_LINE_MISMATCH');
    }
    return Object.freeze(scope);
  }
}
