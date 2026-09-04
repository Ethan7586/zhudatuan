import { channelDigest as digest, channelRequired as required, channelText as text } from './ChannelSyncValue';
import type { SyncSession } from './SyncSession';

export async function synchronizeStatement(session: SyncSession): Promise<void> {
  const run = session.run;
  const start = text(run.input.start, 'STATEMENT_START_REQUIRED');
  const end = text(run.input.end, 'STATEMENT_END_REQUIRED');
  const timezone = text(run.input.timezone, 'STATEMENT_TIMEZONE_REQUIRED');
  const partner = text(run.input.partner, 'STATEMENT_PARTNER_REQUIRED');
  const statement = await session.provider('Statement').pullStatement(await session.providerContext(), { start, end, timezone });
  session.assertActive();
  if (!/^[a-f0-9]{64}$/.test(statement.sha256)) throw new Error('STATEMENT_HASH_INVALID');
  const id = `statement:${digest(`${run.connection}:${start}:${end}`)}`;
  const reconciliation = `reconciliation:${id}`;
  await session.apply('channel.statement.persist', async (context, applying) => {
    await session.saveStatement(context, {
      id,
      connection: run.connection,
      provider: run.provider,
      scope: run.scope,
      partner,
      start,
      end,
      timezone,
      objectReference: statement.objectRef,
      sha256: statement.sha256,
    });
    await required(session.dependencies.finance, 'CHANNEL_FINANCE_PORT_MISSING').receiveReconciliation(context, {
      id: reconciliation,
      scope: run.scope,
      provider: run.provider,
      partner,
      period: `${start}/${end}`,
      statement: id,
      hash: statement.sha256,
      run: run.run,
    });
    await session.scheduleReconciliation(context, reconciliation);
    await session.finish(context, applying, { accepted: 1, rejected: 0, complete: true, cursor: end, errors: [] });
  });
}
