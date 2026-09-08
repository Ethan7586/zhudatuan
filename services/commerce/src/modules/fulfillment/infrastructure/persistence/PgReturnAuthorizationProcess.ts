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
import { PgFulfillmentJobBase } from './PgFulfillmentJobBase';

export class PgReturnAuthorizationProcess extends PgFulfillmentJobBase {
  async authorizeReturn(aftersale: string, execution: FulfillmentJobExecution): Promise<void> {
    const request = await this.manager.read(this.options('system', 'fulfillment.return.read', execution), (context) => this.dependencies.orders.returnRequest(context, aftersale));
    if (!request || request.state === 'returning') return;
    if (request.state !== 'approved' || !request.requiresReturn || request.lines.length === 0) throw new Error('AFTERSALE_RETURN_NOT_RUNNABLE');
    const mapped = await this.manager.read(this.options(request.scope, 'fulfillment.return.map', execution), (context) =>
      this.transactions.database(context).query<{ fulfillment: string; provider: string | null; line: string; quantity: number }>(
        `select fulfillment.id fulfillment,fulfillment.provider,line.order_line_id line,
        least(line.quantity,requested.quantity)::float8 quantity from fulfillment.fulfillmentorder fulfillment
        join fulfillment.line line on line.fulfillment_id=fulfillment.id
        join jsonb_to_recordset($1::jsonb) requested(line text,quantity bigint) on requested.line=line.order_line_id
        where fulfillment.order_id=$2 and fulfillment.state='completed' order by fulfillment.id,line.order_line_id`,
        [JSON.stringify(request.lines), request.order]
      )
    );
    if (new Set(mapped.rows.map(({ line }) => line)).size !== request.lines.length) throw new Error('AFTERSALE_FULFILLMENT_LINE_MISSING');
    const grouped = new Map<string, { provider: string | null; lines: { line: string; quantity: number }[] }>();
    for (const row of mapped.rows) {
      const current = grouped.get(row.fulfillment) ?? { provider: row.provider, lines: [] };
      current.lines.push({ line: row.line, quantity: row.quantity });
      grouped.set(row.fulfillment, current);
    }
    const planned: ReturnPlan[] = [];
    for (const [fulfillment, group] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
      const id = `return:${aftersale}:${fulfillment}`;
      const step = `return:${aftersale}`;
      if (!(await this.manager.write(this.options(request.scope, 'fulfillment.return.saga.begin', execution), (context) => this.saga.begin(this.transactions.database(context), fulfillment, step, id, { aftersale })))) continue;
      const source = request.lines.find(({ line }) => group.lines.some((candidate) => candidate.line === line));
      const configured = source?.policy.returnInstruction;
      let providerReference: string | null = null;
      let instruction: JsonObject;
      let providerResult: ProviderOperationResult | null = null;
      let requestHash: string | null = null;
      if (group.provider) {
        const providerRequest = Object.freeze({
          reference: id,
          fulfillmentReference: fulfillment,
          reason: request.reason,
          lines: Object.freeze(group.lines.map(({ line, quantity }) => Object.freeze({ reference: line, quantity }))),
          evidence: Object.freeze({ aftersale, ...(configured && typeof configured === 'object' && !Array.isArray(configured) ? { policy: configured as JsonObject } : {}) }),
        });
        let response;
        try {
          await this.ensure(group.provider, request.scope);
          response = await this.extensions.strategy(group.provider, request.scope, 'Return').authorize(await this.context(request.scope, execution, id), providerRequest);
        } catch (error) {
          await this.manager.write(this.options(request.scope, 'fulfillment.return.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), fulfillment, step, error));
          throw error;
        }
        if (!success(response.state) && response.state.toLowerCase() !== 'authorized') throw new Error('PROVIDER_RETURN_NOT_AUTHORIZED');
        if (!['address', 'labelUrl', 'message', 'method'].some((key) => typeof response.instruction[key] === 'string' && response.instruction[key].trim())) {
          throw new Error('PROVIDER_RETURN_INSTRUCTION_INVALID');
        }
        providerReference = response.externalReference;
        instruction = response.instruction;
        providerResult = Object.freeze({ externalReference: response.externalReference, state: response.state });
        requestHash = digest(JSON.stringify(providerRequest));
      } else {
        instruction = configured && typeof configured === 'object' && !Array.isArray(configured) ? (configured as JsonObject) : { state: 'authorized', method: 'internal' };
      }
      planned.push(Object.freeze({ id, fulfillment, group, providerReference, instruction, providerResult, requestHash }));
    }
    await this.manager.write(this.options(request.scope, 'fulfillment.return.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      for (const plan of planned) {
        const { id, fulfillment, group, providerReference, instruction, providerResult, requestHash } = plan;
        await database.query(
          `insert into fulfillment.returnrecord(id,aftersale_id,fulfillment_id,scope_id,state,provider,provider_reference,instruction,created_at,updated_at,version)
          values($1,$2,$3,$4,'authorized',$5,$6,$7::jsonb,clock_timestamp(),clock_timestamp(),0)
          on conflict(aftersale_id,fulfillment_id) do nothing`,
          [id, aftersale, fulfillment, request.scope, group.provider, providerReference, JSON.stringify(instruction)]
        );
        for (const line of group.lines) await database.query(`insert into fulfillment.returnline(return_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [id, line.line, line.quantity]);
        if (group.provider && providerResult && requestHash)
          await this.dependencies.operations.record(context, {
            id: `provideroperation:${digest(id)}`,
            provider: group.provider,
            scope: request.scope,
            kind: 'return',
            idempotency: id,
            reference: id,
            state: 'succeeded',
            requestHash,
            result: providerResult,
          });
        await this.saga.succeed(database, fulfillment, `return:${aftersale}`, { return: id, providerReference });
      }
      const returns = await readReturnEvidence(database, aftersale);
      await this.dependencies.orders.markReturning(context, aftersale, returns, execution.trace);
    });
  }
}
