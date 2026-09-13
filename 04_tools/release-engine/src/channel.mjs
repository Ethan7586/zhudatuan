import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { invariant } from './errors.mjs';

export async function channelCommand(adapter, options) {
  const target = required(options.target, 'CHANNEL_TARGET_REQUIRED');
  const channel = adapter.channels?.[target];
  invariant(Boolean(channel), 'CHANNEL_TARGET_UNKNOWN', `Unknown delivery channel ${target}`);
  const action = options.action ?? 'status';
  invariant(['status', 'establish', 'deploy', 'rollback'].includes(action),
    'CHANNEL_ACTION_INVALID', `Unsupported channel action ${action}`);
  const node = options.node ?? options.nodes?.[0] ?? channel.node;
  invariant(node === channel.node, 'CHANNEL_NODE_MISMATCH', `${target} belongs to ${channel.node}`);
  const manifestPath = resolve(dirname(adapter.adapterPath), channel.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  invariant(manifest.schema === 'zdt.edge-channel.v1' && manifest.id === target,
    'CHANNEL_MANIFEST_INVALID', `Invalid channel manifest for ${target}`);
  invariant(manifest.node === node, 'CHANNEL_MANIFEST_NODE_MISMATCH', `${target} manifest belongs to ${manifest.node}`);
  const providerUrl = new URL(channel.providerModule, pathToFileURL(adapter.adapterPath));
  const provider = await import(providerUrl.href);
  invariant(typeof provider.runChannel === 'function', 'CHANNEL_PROVIDER_INVALID', `${target} provider must export runChannel`);
  return provider.runChannel({ adapter, channel, manifest, options: { ...options, action, node, target } });
}

function required(value, code) {
  invariant(typeof value === 'string' && value.length > 0, code, code);
  return value;
}
