import { CHANNEL_SYNC_BATCH_SIZE, channelDigest as digest, channelObject as object, channelRecordError, channelRequired as required, channelText as text } from './ChannelSyncValue';
import type { SyncSession } from './SyncSession';

export async function synchronizeCatalog(session: SyncSession): Promise<void> {
  const run = session.run;
  const batch = await session.provider(['Catalog', 'Brand', 'Store', 'Menu', 'Option', 'Cinema', 'Show', 'GeoStore']).pullCatalog(await session.providerContext(), run.cursor ?? undefined);
  session.assertActive();
  if (batch.records.length + batch.errors.length > CHANNEL_SYNC_BATCH_SIZE) throw new Error('PROVIDER_BATCH_LIMIT_EXCEEDED');
  const cursor = batch.nextCursor ?? run.cursor;
  if (!batch.complete && cursor === run.cursor) throw new Error('PROVIDER_CATALOG_CURSOR_REQUIRED');
  await session.apply('channel.catalog.persist', async (context, applying) => {
    const catalog = required(session.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING');
    for (const record of batch.records) {
      session.assertActive();
      const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
      const version = text(record.version, 'PROVIDER_SOURCE_VERSION_INVALID');
      const payload = object(record.payload);
      const serialized = JSON.stringify(payload);
      await session.saveSource(context, { provider: run.provider, scope: run.scope, external, version, payload });
      await catalog.accept(context, {
        id: `listing:${digest(`${run.scope}:${run.provider}:${external}`)}`,
        provider: run.provider,
        external,
        scope: run.scope,
        version,
        payload: serialized,
        hash: digest(serialized),
      });
    }
    await session.finish(context, applying, {
      accepted: batch.records.length,
      rejected: batch.errors.length,
      complete: batch.complete,
      cursor,
      errors: batch.errors.map((failure) => channelRecordError(failure.key, failure.code)),
    });
  });
}
