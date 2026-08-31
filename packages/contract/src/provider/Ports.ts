export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface ProviderCallContext {
  readonly tenantId: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly idempotencyKey?: string;
  readonly deadline: number;
}

export interface CatalogBatch {
  readonly records: readonly JsonObject[];
  readonly errors: readonly ProviderRecordError[];
  readonly nextCursor?: string;
  readonly complete: boolean;
}

export interface ProviderRecordError {
  readonly key: string;
  readonly code: string;
  readonly message: string;
}

export interface SourceSkuKey {
  readonly externalId: string;
  readonly region?: string;
}
export interface PriceBatch {
  readonly records: readonly JsonObject[];
}
export interface StockBatch {
  readonly records: readonly JsonObject[];
}
export interface RemoteOrderDraft {
  readonly reference: string;
  readonly payload: JsonObject;
}
export interface RemoteOrderReceipt {
  readonly externalReference: string;
  readonly state: string;
  readonly rawReference: string;
}
export interface RemoteOrderState {
  readonly externalReference: string;
  readonly state: string;
}
export interface TrackingSnapshot {
  readonly externalReference: string;
  readonly milestones: readonly JsonObject[];
}
export interface RemoteRefundRequest {
  readonly reference: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly reason: string;
}
export interface RemoteRefundReceipt {
  readonly externalReference: string;
  readonly state: string;
}
export interface RemoteReturnRequest {
  readonly reference: string;
  readonly fulfillmentReference: string;
  readonly reason: string;
  readonly lines: readonly Readonly<{ reference: string; quantity: number }>[];
  readonly evidence: JsonObject;
}
export interface RemoteReturnInstruction {
  readonly externalReference: string;
  readonly state: string;
  readonly instruction: JsonObject;
}
export interface StatementPeriod {
  readonly start: string;
  readonly end: string;
  readonly timezone: string;
}
export interface StatementFile {
  readonly objectRef: string;
  readonly sha256: string;
}
export interface RemoteVerificationRequest {
  readonly reference: string;
  readonly evidence: JsonObject;
}
export interface RemoteVerificationReceipt {
  readonly externalReference: string;
  readonly state: string;
}
export interface ProviderWebhookRequest {
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly receivedAt: string;
}

export interface CatalogSource {
  pullCatalog(context: ProviderCallContext, cursor?: string): Promise<CatalogBatch>;
}
export interface PriceSource {
  pullPrice(context: ProviderCallContext, keys: readonly SourceSkuKey[]): Promise<PriceBatch>;
}
export interface StockSource {
  pullStock(context: ProviderCallContext, keys: readonly SourceSkuKey[]): Promise<StockBatch>;
}
export interface RemoteOrderSubmitter {
  submit(context: ProviderCallContext, order: RemoteOrderDraft): Promise<RemoteOrderReceipt>;
}
export interface RemoteOrderCanceller {
  cancel(context: ProviderCallContext, reference: string, reason: string): Promise<RemoteOrderState>;
}
export interface TrackingSource {
  pullTracking(context: ProviderCallContext, reference: string): Promise<TrackingSnapshot>;
}
export interface RemoteRefundProvider {
  refund(context: ProviderCallContext, request: RemoteRefundRequest): Promise<RemoteRefundReceipt>;
}
export interface RemoteReturnProvider {
  authorize(context: ProviderCallContext, request: RemoteReturnRequest): Promise<RemoteReturnInstruction>;
}
export interface StatementSource {
  pullStatement(context: ProviderCallContext, period: StatementPeriod): Promise<StatementFile>;
}
export interface VerificationProvider {
  verify(context: ProviderCallContext, request: RemoteVerificationRequest): Promise<RemoteVerificationReceipt>;
}
export interface ProviderWebhookVerifier {
  verify(context: ProviderCallContext, request: ProviderWebhookRequest): Promise<boolean>;
  normalize(request: ProviderWebhookRequest): JsonObject;
}

export interface ProviderPorts {
  readonly catalog: CatalogSource;
  readonly price: PriceSource;
  readonly stock: StockSource;
  readonly order: RemoteOrderSubmitter;
  readonly cancel: RemoteOrderCanceller;
  readonly tracking: TrackingSource;
  readonly return: RemoteReturnProvider;
  readonly refund: RemoteRefundProvider;
  readonly statement: StatementSource;
  readonly verification: VerificationProvider;
  readonly webhook: ProviderWebhookVerifier;
}

export type ProviderPortName = keyof ProviderPorts;
