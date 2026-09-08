import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { KmsClient } from '../../../pipeline/KmsPort';
import { transactionManager } from '../../../test/TransactionFixture';
import type { ObjectStore } from '../../runtime/public/ObjectPort';
import type { AuditRepository, ArchiveBatch } from '../application/port/AuditRepository';
import { ArchiveAudit } from '../application/process/ArchiveAudit';
import { EvidenceBundle } from '../domain/model/EvidenceBundle';

const first = 'a'.repeat(64);
const last = 'b'.repeat(64);
const batch: ArchiveBatch = Object.freeze({
  scope: 'mall:one',
  start: '2026-01-01T00:00:00.000Z',
  end: '2026-01-01T00:00:01.000Z',
  firstHash: first,
  lastHash: last,
  rows: Object.freeze([
    Object.freeze({ kind: 'command', id: 'audit:one', record_hash: first, previous_hash: null, operation: 'catalog.publish' }),
    Object.freeze({ kind: 'access', id: 'access:two', record_hash: last, previous_hash: first, operation: 'audit.read' }),
  ]),
  recordIds: Object.freeze(['audit:one']),
  accessIds: Object.freeze(['access:two']),
  archiveYears: 7,
});

describe('audit evidence archive', () => {
  it('rejects a broken source hash chain before creating an object', () => {
    expect(() => new EvidenceBundle(batch.scope, batch.start, batch.end, first, last, [batch.rows[0]!, { ...batch.rows[1]!, previous_hash: '0'.repeat(64) }])).toThrow('AUDIT_EVIDENCE_CHAIN_BROKEN');
  });

  it('seals, locks, verifies and reopens the same evidence bundle', async () => {
    const storage = memoryObjects();
    const crypto = memoryKms();
    const completeArchive = vi.fn();
    const repository = archiveRepository({ completeArchive });
    const archive = new ArchiveAudit(
      transactionManager(async () => empty()),
      storage.store,
      crypto.kms,
      repository
    );
    const signal = new AbortController().signal;
    await archive.execute('trace:one', signal, Date.now() + 30_000);
    await archive.execute('trace:two', signal, Date.now() + 30_000);
    expect(storage.lock).toHaveBeenCalledTimes(2);
    expect(storage.inspect).toHaveBeenCalledTimes(2);
    expect(crypto.decrypt).toHaveBeenCalledTimes(1);
    expect(completeArchive).toHaveBeenCalledTimes(2);
    expect(completeArchive.mock.calls[0]?.[2]).toMatchObject({ plaintextHash: expect.stringMatching(/^[a-f0-9]{64}$/), indexHash: expect.stringMatching(/^[a-f0-9]{64}$/), entries: [{ id: 'audit:one' }, { id: 'access:two' }] });
  });

  it('removes an expired object only after repository legal-retention selection and records disposal', async () => {
    const remove = vi.fn(async () => undefined);
    const completeDisposal = vi.fn(async () => undefined);
    const scheduleArchive = vi.fn(async () => undefined);
    const repository = archiveRepository({
      disposalBatch: vi.fn(async () => ({ archive: 'archive:one', reference: 'object:expired', sha256: first, scope: 'mall:one' })),
      completeDisposal,
      scheduleArchive,
    });
    const archive = new ArchiveAudit(
      transactionManager(async () => empty()),
      { remove } as unknown as ObjectStore,
      memoryKms().kms,
      repository
    );
    await archive.execute('trace:disposal', new AbortController().signal, Date.now() + 30_000);
    expect(remove).toHaveBeenCalledWith('object:expired');
    expect(completeDisposal).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ archive: 'archive:one' }), 'trace:disposal');
    expect(scheduleArchive).toHaveBeenCalledWith(expect.anything(), true);
  });
});

function archiveRepository(overrides: Partial<AuditRepository>): AuditRepository {
  return {
    disposalBatch: async () => null,
    archiveBatch: async () => batch,
    completeArchive: async () => undefined,
    completeDisposal: async () => undefined,
    scheduleArchive: async () => undefined,
    previous: async () => null,
    appendRecord: async () => undefined,
    appendAccess: async () => undefined,
    ...overrides,
  };
}

function memoryKms() {
  let plaintext = '';
  const decrypt = vi.fn(async () => plaintext);
  const kms = {
    encrypt: vi.fn(async (_purpose, _key, value: string) => {
      plaintext = value;
      return { ciphertext: 'encrypted-evidence-envelope', fingerprint: 'f'.repeat(64), keyVersion: 'kms:v2' };
    }),
    decrypt,
  } as unknown as KmsClient;
  return { kms, decrypt };
}

function memoryObjects() {
  const paths = new Map<string, { bytes: Uint8Array; metadata: { reference: string; sha256: string; size: number; scan: 'clean'; contentType: string; path: string; retentionUntil: null; lockedUntil: null } }>();
  const references = new Map<string, ReturnType<typeof paths.get>>();
  const lock = vi.fn(async (_reference: string, until: string) => ({ mode: 'compliance' as const, lockedUntil: until }));
  const inspect = vi.fn(async (reference: string) => {
    const value = references.get(reference);
    if (!value) throw new Error('NOT_FOUND');
    return value.metadata;
  });
  const store = {
    find: async (path: string) => paths.get(path)?.metadata ?? null,
    create: async (path: string, contentType: string) => {
      const chunks: Uint8Array[] = [];
      return {
        append: async (bytes: Uint8Array) => {
          chunks.push(bytes);
        },
        abort: async () => undefined,
        complete: async () => {
          const bytes = concat(chunks);
          const metadata = {
            reference: `object:${createHash('sha256').update(path).digest('hex')}`,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            size: bytes.byteLength,
            scan: 'clean' as const,
            contentType,
            path,
            retentionUntil: null,
            lockedUntil: null,
          };
          const value = { bytes, metadata };
          paths.set(path, value);
          references.set(metadata.reference, value);
          return metadata;
        },
      };
    },
    read: async (reference: string) => {
      const value = references.get(reference);
      if (!value) throw new Error('NOT_FOUND');
      return value.bytes;
    },
    lock,
    inspect,
  } as unknown as ObjectStore;
  return { store, lock, inspect };
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function empty() {
  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as never;
}
