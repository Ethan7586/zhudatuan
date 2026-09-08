import { randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCallContext, ProviderOperationResult } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { FulfillmentJobExecution, FulfillmentJobProcess } from '../../application/port/FulfillmentJobProcess';
import { enqueueFulfillment as enqueue, fulfillmentDigest as digest, providerSucceeded as success, requiredJobText as text } from './FulfillmentJobValue';
import type { FulfillmentJobDependencies, FulfillmentRow, ReturnPlan } from './FulfillmentJobContext';
import { projectFulfillment } from './FulfillmentProjection';
import { readReturnEvidence } from './ReturnEvidence';
import { PgFulfillmentSaga } from './PgFulfillmentSaga';
import { fulfillment, fulfillmentLines as lines, trackingState } from './FulfillmentJobRecord';

export class PgFulfillmentJobBase {
  protected readonly transactions = new PgTransactionAccess();
  protected readonly saga = new PgFulfillmentSaga();

  constructor(
    protected readonly manager: TransactionManager,
    protected readonly extensions: ExtensionRegistry,
    protected readonly dependencies: FulfillmentJobDependencies
  ) {}

  protected load(id: string, states: readonly string[], execution: FulfillmentJobExecution): Promise<FulfillmentRow> {
    return this.manager.read(this.options('system', 'fulfillment.load', execution), async (context) => {
      const result = await this.transactions.database(context).query<FulfillmentRow>(
        `select fulfillment.id,fulfillment.order_id,fulfillment.provider,fulfillment.state,fulfillment.version::float8 version,
        fulfillment.scope_id,fulfillment.member_id,fulfillment.route,fulfillment.kind,
        fulfillment.external_reference,coalesce(jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity)
        order by line.order_line_id) filter(where line.order_line_id is not null),'[]') lines from fulfillment.fulfillmentorder fulfillment
        left join fulfillment.line line on line.fulfillment_id=fulfillment.id
        where fulfillment.id=$1 and fulfillment.state=any($2::text[]) group by fulfillment.id`,
        [id, states]
      );
      const row = result.rows[0];
      if (!row) throw new Error('FULFILLMENT_NOT_RUNNABLE');
      return Object.freeze(row);
    });
  }

  protected async synthetic(database: ReturnType<PgTransactionAccess['database']>, loaded: FulfillmentRow, execution: FulfillmentJobExecution): Promise<void> {
    const shipment = `shipment:${digest(`${loaded.id}:digital`)}`;
    const packageId = `package:${digest(`${loaded.id}:digital`)}`;
    await database.query(
      `insert into fulfillment.shipment(id,fulfillment_id,state,provider_reference,shipped_at,delivered_at,created_at,updated_at,version)
      values($1,$2,'delivered',$3,clock_timestamp(),clock_timestamp(),clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
      [shipment, loaded.id, loaded.external_reference]
    );
    await database.query(
      `insert into fulfillment.package(id,shipment_id,carrier,tracking_number,provider_reference,state,created_at,updated_at,version)
      values($1,$2,null,$3,$4,'completed',clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
      [packageId, shipment, `DIGITAL-${digest(loaded.id).slice(0, 16)}`, loaded.external_reference]
    );
    for (const line of lines(loaded)) await database.query(`insert into fulfillment.packageline(package_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [packageId, line.line, line.quantity]);
    await database.query(
      `insert into fulfillment.trackingevent(id,package_id,provider_event_id,state,description,location,evidence,occurred_at,received_at)
      values($1,$2,$3,'completed','权益已发放',null,$4::jsonb,clock_timestamp(),clock_timestamp()) on conflict(package_id,provider_event_id) do nothing`,
      [`tracking:${digest(`${loaded.id}:completed`)}`, packageId, `completed:${loaded.id}`, JSON.stringify({ route: loaded.route, trace: execution.trace })]
    );
    await new PgRuntimeWriter(database).append({
      id: `event:fulfillment:shipped:${digest(loaded.id)}`,
      type: 'fulfillment.shipped',
      aggregateType: 'fulfillment',
      aggregate: loaded.id,
      scope: loaded.scope_id,
      payload: { fulfillment: loaded.id, order: loaded.order_id, member: loaded.member_id, state: 'delivered' },
      trace: execution.trace,
    });
  }

  replay(operation: string, execution: FulfillmentJobExecution): Promise<string> {
    return this.manager.read(this.options('system', 'fulfillment.replay', execution), (context) => this.dependencies.operations.replayReference(context, operation, 'order'));
  }

  protected async ensure(provider: string, scope: string): Promise<void> {
    if (!this.extensions.has(provider, scope)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
  }

  protected async context(scope: string, execution: FulfillmentJobExecution, key?: string): Promise<ProviderCallContext> {
    const organization = await this.manager.read(this.options(scope, 'fulfillment.provider.context', execution), (context) => this.dependencies.organizations.scope(context, scope));
    return { tenantId: organization.tenant ?? scope, requestId: execution.trace, traceId: execution.trace, ...(key ? { idempotencyKey: key } : {}), deadline: execution.deadline };
  }

  protected options(scope: string, operation: string, execution: FulfillmentJobExecution): TransactionOptions {
    return { tenant: scope, membership: 'system', scope, actor: 'system', trace: execution.trace, operation, deadline: execution.deadline, signal: execution.signal, workload: 'jobs' };
  }
}
