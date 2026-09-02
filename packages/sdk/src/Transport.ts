export interface TransportRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

export interface TransportResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface StreamTransportResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly stream?: ReadableStream<Uint8Array>;
}

export interface Transport {
  send(request: TransportRequest): Promise<TransportResponse>;
  open?(request: TransportRequest): Promise<StreamTransportResponse>;
}
