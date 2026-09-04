import { ExternalMapping } from '../../domain/model/ExternalMapping';
import { CHANNEL_SYNC_BATCH_SIZE, channelDigest as digest, channelInteger as integer, channelRecordError, channelRequired as required, channelText as text } from './ChannelSyncValue';
import type { SyncSession } from './SyncSession';

export async function synchronizeStock(session: SyncSession): Promise<void> {
  const run = session.run;
  const keys = await session.keys();
  if (keys.length === 0) return session.complete();
  if (keys.length > CHANNEL_SYNC_BATCH_SIZE) throw new Error('CHANNEL_KEY_BATCH_LIMIT_EXCEEDED');
  const batch = await session.provider(['Inventory', 'GeoStock', 'TimeSlot', 'GeoDelivery']).pullStock(await session.providerContext(), keys);
  session.assertActive();
  if (batch.records.length > keys.length) throw new Error('PROVIDER_BATCH_LIMIT_EXCEEDED');
  const requested = new Set(keys.map(({ externalId }) => externalId));
  await session.apply('channel.stock.persist', async (context, applying) => {
    const catalog = required(session.dependencies.catalog, 'CHANNEL_CATALOG_PORT_MISSING');
    const inventory = required(session.dependencies.inventory, 'CHANNEL_INVENTORY_PORT_MISSING');
    let accepted = 0;
    const errors: ReturnType<typeof channelRecordError>[] = [];
    const seen = new Set<string>();
    for (const record of batch.records) {
      session.assertActive();
      const external = text(record.externalId, 'PROVIDER_EXTERNAL_ID_INVALID');
      if (!requested.has(external) || seen.has(external)) {
        errors.push(channelRecordError(external, seen.has(external) ? 'PROVIDER_RECORD_DUPLICATE' : 'PROVIDER_RECORD_UNREQUESTED'));
        continue;
      }
      seen.add(external);
      const sku = await catalog.sku(context, run.provider, run.scope, external);
      if (!sku) {
        errors.push(channelRecordError(external, 'CHANNEL_EXTERNAL_MAPPING_MISSING'));
        continue;
      }
      const version = String(record.version ?? session.execution.trace);
      new ExternalMapping({
        provider: run.provider,
        scope: run.scope,
        objectType: 'product',
        externalId: external,
        internalType: 'sku',
        internalId: sku,
        sourceVersion: version,
        watermark: new Date().toISOString(),
        version: 0,
      });
      await inventory.observe(context, {
        id: `stock:${digest(`${run.scope}:${sku}:${run.region}`)}`,
        scope: run.scope,
        sku,
        location: run.region,
        onhand: integer(record.onhand, 'PROVIDER_STOCK_INVALID'),
        safety: integer(record.safety ?? 0, 'PROVIDER_SAFETY_STOCK_INVALID'),
        provider: run.provider,
        version,
      });
      accepted += 1;
    }
    await session.finish(context, applying, {
      accepted,
      rejected: errors.length,
      complete: keys.length < CHANNEL_SYNC_BATCH_SIZE,
      cursor: keys.at(-1)?.externalId ?? run.cursor,
      errors,
    });
  });
}
