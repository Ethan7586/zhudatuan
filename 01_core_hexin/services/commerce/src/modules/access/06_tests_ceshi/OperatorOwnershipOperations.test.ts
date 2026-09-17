import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { operatorOwnershipStore } from '../04_adapters_shixian/persistence/OperatorOwnershipStore';
import { operatorOwnershipActions } from '../03_application_yingyong/OperatorOwnershipOperations';

afterEach(() => vi.restoreAllMocks());

describe('operator ownership slice', () => {
  it('keeps transfer preview and creation on the same original proof and outbox path', async () => {
    const container = new Container();
    container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-key', session: 'session-key' });
    const actions = operatorOwnershipActions({ container } as unknown as ModuleContext);
    const preview = actions['access.ownership.transfers.preview'];
    const create = actions['access.ownership.transfers.create'];
    if (typeof preview !== 'function' || typeof create !== 'function') throw new Error('OWNER_TRANSFER_ACTION_MISSING');

    const snapshot = { sourceMembership: 'membership:owner', targetMembership: 'membership:successor',
      formerOwnerMode: 'remove_admin' as const, formerOwnerRole: null, formerOwnerRoleVersion: null,
      ownershipVersion: 4, transferVersion: null, targetAccessVersion: 2 };
    const snapshotCall = vi.spyOn(operatorOwnershipStore, 'createProofSnapshot').mockResolvedValue(snapshot);
    const registered = vi.spyOn(operatorOwnershipStore, 'registerProof').mockResolvedValue(undefined);
    const transferred = vi.spyOn(operatorOwnershipStore, 'createOwnerTransfer').mockResolvedValue({ id: 'owner-transfer:next', version: 0 });
    const database = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as OperationDatabase;
    const request = { input: { body: { targetMembership: snapshot.targetMembership, formerOwnerMode: snapshot.formerOwnerMode },
      headers: {}, expectedVersion: 4 }, access: { actor: { id: 'principal:owner', session: 'session:owner' },
      membership: { id: snapshot.sourceMembership }, trace: 'trace:owner-transfer' } } as unknown as OperationRequest;

    const previewResult = await preview(request, database);
    const proof = (previewResult.body as { proof: string }).proof;
    const created = await create({ ...request, input: { ...request.input, headers: { 'x-action-proof': proof } } }, database);

    expect(previewResult.status).toBe(200);
    expect(created).toMatchObject({ status: 201, body: { id: 'owner-transfer:next' } });
    expect(snapshotCall).toHaveBeenCalledTimes(2);
    expect(registered).toHaveBeenCalledOnce();
    expect(transferred).toHaveBeenCalledWith(database, expect.stringMatching(/^owner-transfer:/),
      expect.objectContaining({ sourceMembership: snapshot.sourceMembership, targetMembership: snapshot.targetMembership }));
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('insert into runtime.outbox'),
      expect.arrayContaining(['access.owner.transfer.initiated']));
  });
});
