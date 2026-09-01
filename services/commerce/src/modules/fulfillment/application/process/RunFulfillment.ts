import type { FulfillmentJobExecution, FulfillmentJobProcess } from '../port/FulfillmentJobProcess';

export class RunFulfillment {
  constructor(private readonly process: FulfillmentJobProcess) {}

  authorizeReturn(aftersale: string, execution: FulfillmentJobExecution): Promise<void> {
    return this.process.authorizeReturn(aftersale, execution);
  }

  async submit(fulfillment: string | undefined, operation: string | undefined, execution: FulfillmentJobExecution): Promise<void> {
    const id = fulfillment ?? (await this.process.replay(required(operation, 'PROVIDER_OPERATION_REQUIRED'), execution));
    await this.process.submit(id, execution);
  }

  async track(fulfillment: string | undefined, operation: string | undefined, execution: FulfillmentJobExecution): Promise<void> {
    const id = fulfillment ?? (await this.process.replay(required(operation, 'PROVIDER_OPERATION_REQUIRED'), execution));
    await this.process.track(id, execution);
  }
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}
