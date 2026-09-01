export interface FulfillmentJobExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface FulfillmentJobProcess {
  authorizeReturn(aftersale: string, execution: FulfillmentJobExecution): Promise<void>;
  replay(operation: string, execution: FulfillmentJobExecution): Promise<string>;
  submit(fulfillment: string, execution: FulfillmentJobExecution): Promise<void>;
  track(fulfillment: string, execution: FulfillmentJobExecution): Promise<void>;
}
