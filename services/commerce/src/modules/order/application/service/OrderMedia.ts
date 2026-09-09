import { mapConcurrent } from '@shop/kernel';
import type { AssetPort } from '../../../runtime/public';

type RecordValue = Readonly<Record<string, unknown>>;

const LINK_CONCURRENCY = 8;

export class OrderMedia {
  constructor(private readonly assets: Pick<AssetPort, 'link'>) {}

  async orders(rows: readonly RecordValue[]): Promise<readonly RecordValue[]> {
    const lines = rows.flatMap((row) => records(row.lines));
    const links = await this.links(lines);
    return Object.freeze(rows.map((row) => Object.freeze({ ...row, lines: present(records(row.lines), links) })));
  }

  async lines(rows: readonly RecordValue[]): Promise<readonly RecordValue[]> {
    return present(rows, await this.links(rows));
  }

  private async links(rows: readonly RecordValue[]): Promise<ReadonlyMap<string, string>> {
    const references = [...new Set(rows.flatMap((row) => text(row.imageReference)))];
    const resolved = await mapConcurrent(references, LINK_CONCURRENCY, async (reference) => {
      try {
        const linked = await this.assets.link(reference);
        return [reference, safeImage(linked.url)] as const;
      } catch {
        return [reference, null] as const;
      }
    });
    return new Map(resolved.flatMap(([reference, url]) => (url === null ? [] : [[reference, url]])));
  }
}

function present(rows: readonly RecordValue[], links: ReadonlyMap<string, string>): readonly RecordValue[] {
  return Object.freeze(
    rows.map((row) => {
      const { imageReference: _imageReference, imageUrl: _imageUrl, ...visible } = row;
      const reference = text(row.imageReference)[0];
      const image = (reference === undefined ? undefined : links.get(reference)) ?? safeImage(typeof row.imageUrl === 'string' ? row.imageUrl : null);
      return Object.freeze({ ...visible, image });
    })
  );
}

function records(value: unknown): readonly RecordValue[] {
  return Array.isArray(value) ? value.filter((item): item is RecordValue => item !== null && typeof item === 'object' && !Array.isArray(item)) : [];
}

function text(value: unknown): string[] {
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}

function safeImage(value: string | null): string | null {
  if (value === null || value === '') return null;
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}
