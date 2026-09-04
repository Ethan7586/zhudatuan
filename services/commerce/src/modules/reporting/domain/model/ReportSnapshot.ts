import { createHash } from 'node:crypto';
import type { ReportDimension, ReportPeriod } from './Metric';

export interface DataWatermark {
  readonly event: string;
  readonly occurredAt: string;
  readonly version: number;
}

export interface ReportQuery {
  readonly scope: string;
  readonly dimension: ReportDimension | null;
  readonly period: ReportPeriod;
  readonly application: string | null;
}

export interface SnapshotCursor {
  readonly sort: string;
  readonly row: string;
  readonly snapshot: ReportSnapshot;
}

export class ReportSnapshot {
  readonly queryHash: string;

  constructor(
    readonly query: ReportQuery,
    readonly watermark: DataWatermark,
    readonly generatedAt: string,
    readonly generationVersion = 1
  ) {
    if (
      !query.scope ||
      (query.dimension !== null && !['sales', 'product', 'mall', 'category', 'channel', 'voucher', 'member'].includes(query.dimension)) ||
      !['realtime', 'yesterday', '7days', '30days'].includes(query.period) ||
      (query.application !== null && (!query.application || query.application.length > 100)) ||
      !watermark.event ||
      Number.isNaN(Date.parse(watermark.occurredAt)) ||
      !Number.isSafeInteger(watermark.version) ||
      watermark.version < 1 ||
      Number.isNaN(Date.parse(generatedAt)) ||
      Date.parse(watermark.occurredAt) > Date.parse(generatedAt) ||
      !Number.isSafeInteger(generationVersion) ||
      generationVersion < 1
    ) throw new Error('REPORT_SNAPSHOT_INVALID');
    this.query = Object.freeze({ ...query });
    this.watermark = Object.freeze({ ...watermark });
    this.queryHash = queryDigest(this.query);
    Object.freeze(this);
  }

  cursor(sort: string, row: string): string {
    if (!sort || sort.length > 64 || !row || row.length > 255) throw new Error('REPORT_CURSOR_ROW_INVALID');
    return Buffer.from(JSON.stringify({
      v: this.generationVersion,
      q: this.queryHash,
      s: sort,
      r: row,
      e: this.watermark.event,
      w: this.watermark.occurredAt,
      x: this.watermark.version,
      g: this.generatedAt,
    }), 'utf8').toString('base64url');
  }

  static resume(value: string, query: ReportQuery): SnapshotCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
      const snapshot = new ReportSnapshot(query, {
        event: text(parsed.e), occurredAt: text(parsed.w), version: integer(parsed.x),
      }, text(parsed.g), integer(parsed.v));
      if (parsed.q !== snapshot.queryHash || typeof parsed.s !== 'string' || !parsed.s || parsed.s.length > 64 ||
        typeof parsed.r !== 'string' || !parsed.r || parsed.r.length > 255 || snapshot.cursor(parsed.s, parsed.r) !== value) {
        throw new Error('REPORT_CURSOR_INVALID');
      }
      return Object.freeze({ sort: parsed.s, row: parsed.r, snapshot });
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'REPORT_CURSOR_INVALID') throw cause;
      throw new Error('REPORT_CURSOR_INVALID', { cause });
    }
  }

  static restore(value: unknown, query: ReportQuery): ReportSnapshot {
    try {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('REPORT_SNAPSHOT_INVALID');
      const source = value as Readonly<Record<string, unknown>>;
      const suppliedQuery = source.query;
      const watermark = source.watermark;
      if (suppliedQuery === null || typeof suppliedQuery !== 'object' || Array.isArray(suppliedQuery) ||
        watermark === null || typeof watermark !== 'object' || Array.isArray(watermark)) throw new Error('REPORT_SNAPSHOT_INVALID');
      const selected = new ReportSnapshot(query, {
        event: text((watermark as Record<string, unknown>).event),
        occurredAt: text((watermark as Record<string, unknown>).occurredAt),
        version: integer((watermark as Record<string, unknown>).version),
      }, text(source.generatedAt), integer(source.generationVersion));
      const restoredQuery = suppliedQuery as Readonly<Record<string, unknown>>;
      if (Object.keys(restoredQuery).sort().join(',') !== 'application,dimension,period,scope' ||
        restoredQuery.scope !== selected.query.scope || restoredQuery.dimension !== selected.query.dimension ||
        restoredQuery.period !== selected.query.period || restoredQuery.application !== selected.query.application ||
        Object.keys(watermark).sort().join(',') !== 'event,occurredAt,version' ||
        Object.keys(source).sort().join(',') !== 'generatedAt,generationVersion,query,watermark') {
        throw new Error('REPORT_SNAPSHOT_INVALID');
      }
      return selected;
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'REPORT_SNAPSHOT_INVALID') throw cause;
      throw new Error('REPORT_SNAPSHOT_INVALID', { cause });
    }
  }

  toJSON() {
    return Object.freeze({ query: this.query, watermark: this.watermark, generatedAt: this.generatedAt, generationVersion: this.generationVersion });
  }
}

function queryDigest(query: ReportQuery): string {
  return createHash('sha256').update(JSON.stringify(query)).digest('base64url');
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('REPORT_CURSOR_INVALID');
  return value;
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value)) throw new Error('REPORT_CURSOR_INVALID');
  return value as number;
}
