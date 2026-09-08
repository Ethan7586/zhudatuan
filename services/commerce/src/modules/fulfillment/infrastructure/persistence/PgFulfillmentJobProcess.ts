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
import { PgFulfillmentSubmissionProcess } from './PgFulfillmentSubmissionProcess';

export class PgFulfillmentJobProcess extends PgFulfillmentSubmissionProcess implements FulfillmentJobProcess {
  async track(id: string, execution: FulfillmentJobExecution): Promise<void> {
    const loaded = await this.load(id, ['accepted', 'processing', 'ready', 'completed', 'cancelled'], execution);
    if (loaded.state === 'completed' || loaded.state === 'cancelled') return;
    if (!loaded.provider || !loaded.external_reference) return;
    const step = `tracking:${execution.trace}`;
    if (
      !(await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.begin', execution), (context) =>
        this.saga.begin(this.transactions.database(context), id, step, `tracking:${id}:${execution.trace}`, { externalReference: loaded.external_reference })
      ))
    )
      return;
    let snapshot;
    try {
      await this.ensure(loaded.provider, loaded.scope_id);
      snapshot = await this.extensions.strategy(loaded.provider, loaded.scope_id, ['Shipment', 'Logistics', 'Delivery', 'Pickup', 'Query']).pullTracking(await this.context(loaded.scope_id, execution), loaded.external_reference);
    } catch (error) {
      await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), id, step, error));
      throw error;
    }
    await this.manager.write(this.options(loaded.scope_id, 'fulfillment.tracking.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      let completed = false;
      let shipped = false;
      let observed = 0;
      const shipment = `shipment:${digest(`${id}:${snapshot.externalReference}`)}`;
      const tracking = snapshot.milestones.map((value) => (typeof value.tracking === 'string' ? value.tracking : typeof value.trackingNumber === 'string' ? value.trackingNumber : null)).find(Boolean) ?? snapshot.externalReference;
      const packageId = `package:${digest(shipment)}`;
      await database.query(
        `insert into fulfillment.shipment(id,fulfillment_id,state,provider_reference,shipped_at,delivered_at,created_at,updated_at,version)
        values($1,$2,'draft',$3,null,null,clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
        [shipment, id, snapshot.externalReference]
      );
      await database.query(
        `insert into fulfillment.package(id,shipment_id,carrier,tracking_number,provider_reference,state,created_at,updated_at,version)
        values($1,$2,null,$3,$4,'created',clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
        [packageId, shipment, tracking, snapshot.externalReference]
      );
      for (const line of lines(loaded)) await database.query(`insert into fulfillment.packageline(package_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [packageId, line.line, line.quantity]);
      for (const value of snapshot.milestones) {
        const state = trackingState(text(value.state, 'TRACKING_STATE_INVALID'));
        const external = typeof value.externalId === 'string' ? value.externalId : digest(JSON.stringify(value));
        const occurred = typeof value.occurredAt === 'string' ? value.occurredAt : new Date().toISOString();
        completed ||= ['delivered', 'completed', 'pickedup'].includes(state);
        shipped ||= ['shipped', 'intransit', 'outfordelivery', 'delivered', 'completed', 'pickedup'].includes(state);
        const inserted = await database.query(
          `insert into fulfillment.trackingevent(id,package_id,provider_event_id,state,description,location,evidence,occurred_at,received_at)
          values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,clock_timestamp()) on conflict(package_id,provider_event_id) do nothing returning id`,
          [
            `tracking:${digest(`${id}:${external}`)}`,
            packageId,
            external,
            state,
            typeof value.description === 'string' ? value.description : state,
            typeof value.location === 'string' ? value.location : null,
            JSON.stringify(value),
            occurred,
          ]
        );
        if (inserted.rows[0]) {
          observed += 1;
          await database.query(
            `update fulfillment.package set state=$2,updated_at=clock_timestamp(),version=version+1 where id=$1 and $2<>'exception'
          and array_position(array['created','accepted','ready','shipped','intransit','outfordelivery','delivered','pickedup','completed','returned'],state)
            <=array_position(array['created','accepted','ready','shipped','intransit','outfordelivery','delivered','pickedup','completed','returned'],$2)`,
            [packageId, state]
          );
        }
      }
      if (observed === 0) {
        await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 300);
        await this.saga.succeed(database, id, step, { state: loaded.state, milestones: 0, duplicate: true });
        return;
      }
      const next = fulfillment(loaded).observed(completed);
      const changed = await database.query(
        `update fulfillment.fulfillmentorder set state=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$3 and version=$4 returning id`,
        [id, next, loaded.state, loaded.version]
      );
      if (!changed.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      await database.query(
        `update fulfillment.shipment set state=case when $2::boolean then 'delivered' when $3::boolean then 'shipped' else state end,
        shipped_at=case when $3::boolean then coalesce(shipped_at,clock_timestamp()) else shipped_at end,
        delivered_at=case when $2::boolean then coalesce(delivered_at,clock_timestamp()) else delivered_at end,
        updated_at=clock_timestamp(),version=version+1 where id=$1`,
        [shipment, completed, shipped]
      );
      await projectFulfillment(this.transactions, this.dependencies.orders, context, id, loaded.order_id);
      if (shipped) {
        await new PgRuntimeWriter(database).append({
          id: `event:fulfillment:shipped:${digest(id)}`,
          type: 'fulfillment.shipped',
          aggregateType: 'fulfillment',
          aggregate: id,
          scope: loaded.scope_id,
          payload: { fulfillment: id, order: loaded.order_id, member: loaded.member_id, state: completed ? 'delivered' : 'shipped' },
          trace: execution.trace,
        });
      }
      if (completed) await this.dependencies.orders.completeFulfillment(context, loaded.order_id, lines(loaded));
      else await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 300);
      await this.saga.succeed(database, id, step, { state: next, milestones: snapshot.milestones.length });
    });
  }
}

export type { FulfillmentJobDependencies } from './FulfillmentJobContext';
