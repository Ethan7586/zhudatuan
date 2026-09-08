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
import { PgReturnAuthorizationProcess } from './PgReturnAuthorizationProcess';

export class PgFulfillmentSubmissionProcess extends PgReturnAuthorizationProcess {
  async submit(id: string, execution: FulfillmentJobExecution): Promise<void> {
    const loaded = await this.load(id, ['pending', 'failed', 'submitted', 'accepted', 'processing', 'ready', 'completed'], execution);
    if (!['pending', 'failed'].includes(loaded.state)) return;
    const aggregate = fulfillment(loaded);
    const step = 'submit';
    if (
      !(await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.begin', execution), (context) =>
        this.saga.begin(this.transactions.database(context), id, step, `fulfillment:${id}`, { route: loaded.route, kind: loaded.kind })
      ))
    )
      return;
    if (loaded.provider === null) {
      try {
        await this.manager.write(this.options(loaded.scope_id, 'fulfillment.internal.accept', execution), async (context) => {
          const database = this.transactions.database(context);
          const state = aggregate.internalAccepted();
          let reference = loaded.external_reference;
          let issued = 0;
          if (loaded.route === 'voucher') {
            const demand = lines(loaded);
            const subjects = await this.dependencies.orders.lineSkus(
              context,
              loaded.order_id,
              demand.map(({ line }) => line)
            );
            if (subjects.length !== demand.length) throw new Error('VOUCHER_FULFILLMENT_SUBJECT_MISMATCH');
            const byLine = new Map(subjects.map((subject) => [subject.line, subject]));
            const receipt = await this.dependencies.vouchers.issue(context, {
              fulfillment: loaded.id,
              order: loaded.order_id,
              scope: loaded.scope_id,
              member: loaded.member_id,
              items: demand.map(({ line, quantity }) => {
                const subject = byLine.get(line);
                if (!subject) throw new Error('VOUCHER_FULFILLMENT_SUBJECT_MISMATCH');
                return Object.freeze({ line, quantity, sku: subject.sku, product: subject.product });
              }),
            });
            reference = receipt.reference;
            issued = receipt.vouchers.length;
          }
          const result = await database.query(
            `update fulfillment.fulfillmentorder set state=$2,external_reference=$5,updated_at=clock_timestamp(),version=version+1
            where id=$1 and state=$3 and version=$4 returning id`,
            [id, state, loaded.state, loaded.version, reference]
          );
          if (!result.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
          if (state === 'completed') {
            await this.synthetic(database, { ...loaded, external_reference: reference }, execution);
            await this.dependencies.orders.completeFulfillment(context, loaded.order_id, lines(loaded));
          }
          await projectFulfillment(this.transactions, this.dependencies.orders, context, id, loaded.order_id);
          await this.saga.succeed(database, id, step, { state, ...(reference ? { reference } : {}), ...(issued > 0 ? { issued } : {}) });
        });
      } catch (error) {
        await this.manager.write(this.options(loaded.scope_id, 'fulfillment.internal.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), id, step, error));
        throw error;
      }
      return;
    }
    const provider = loaded.provider;
    const draft = { reference: id, payload: { order: loaded.order_id, lines: loaded.lines, route: loaded.route, kind: loaded.kind } as JsonObject };
    let receipt;
    try {
      await this.ensure(provider, loaded.scope_id);
      receipt = await this.extensions.strategy(provider, loaded.scope_id, ['Order', 'Issue', 'DirectCharge', 'SeatLock']).submit(await this.context(loaded.scope_id, execution, `fulfillment:${id}`), draft);
    } catch (error) {
      await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), id, step, error));
      throw error;
    }
    const serialized = JSON.stringify(draft.payload);
    await this.manager.write(this.options(loaded.scope_id, 'fulfillment.submit.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      const accepted = aggregate.providerAccepted(success(receipt.state));
      const result = await database.query(
        `update fulfillment.fulfillmentorder set state=$3,external_reference=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$4 and version=$5 returning id`,
        [id, receipt.externalReference, accepted, loaded.state, loaded.version]
      );
      if (!result.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      await this.dependencies.operations.record(context, {
        id: `provideroperation:${randomUUID()}`,
        provider,
        scope: loaded.scope_id,
        kind: 'order',
        idempotency: id,
        reference: id,
        state: success(receipt.state) ? 'succeeded' : 'processing',
        requestHash: digest(serialized),
        result: { externalReference: receipt.externalReference, state: receipt.state },
      });
      if (accepted === 'completed') {
        await this.synthetic(database, { ...loaded, external_reference: receipt.externalReference }, execution);
        await this.dependencies.orders.completeFulfillment(context, loaded.order_id, lines(loaded));
      } else if (accepted === 'accepted') await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 60);
      await projectFulfillment(this.transactions, this.dependencies.orders, context, id, loaded.order_id);
      await this.saga.succeed(database, id, step, { state: accepted, externalReference: receipt.externalReference });
    });
  }
}
