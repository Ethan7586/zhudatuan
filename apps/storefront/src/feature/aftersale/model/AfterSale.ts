import type { AfterSaleLine, AvailableAfterSaleLine } from './AfterSaleLine';
import type { AfterSaleReturn } from './Return';

export type AfterSaleState = 'applied' | 'reviewing' | 'approved' | 'returning' | 'received' | 'refunding' | 'resolved' | 'rejected';

export interface AfterSaleAttachment {
  readonly objectId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
}

export type AfterSaleAttachmentInput = Readonly<{
  readonly objectId: string;
  readonly name: string;
  readonly contentType: 'image/jpeg' | 'image/png' | 'application/pdf';
  readonly sizeBytes: number;
  readonly sha256: string;
}>;

export interface AfterSaleAttachmentDraft {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly state: 'uploading' | 'ready' | 'failed';
  readonly receipt?: AfterSaleAttachmentInput;
  readonly error?: string;
}

export interface AfterSaleTimelineItem {
  readonly sequence: number;
  readonly kind: string;
  readonly previousState: AfterSaleState | null;
  readonly state: AfterSaleState;
  readonly evidence: unknown;
  readonly occurredAt: string;
}

export interface AfterSale {
  readonly id: string;
  readonly orderId: string;
  readonly state: AfterSaleState;
  readonly reasonCode: string;
  readonly description: string;
  readonly currency: string;
  readonly expectedRefundMinor: number;
  readonly expectedRefund: Readonly<{ totalMinor: number; currency: string; tenders: readonly Readonly<{ kind: string; reference: string | null; amountMinor: number }>[] }>;
  readonly requiresReturn: boolean;
  readonly unavailableReason: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly lines: readonly AfterSaleLine[];
  readonly attachments: readonly AfterSaleAttachment[];
  readonly returns: readonly AfterSaleReturn[];
  readonly timeline: readonly AfterSaleTimelineItem[];
}

export interface AfterSalePage {
  readonly items: readonly AfterSale[];
  readonly availableLines: readonly AvailableAfterSaleLine[];
  readonly nextCursor: string | null;
}

export interface ApplyAfterSaleInput {
  readonly lines: readonly Readonly<{ lineId: string; quantity: number }>[];
  readonly reason: string;
  readonly description: string;
  readonly attachments: readonly AfterSaleAttachmentInput[];
}
