import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { journey } from './JourneyHarness';

journey('MVPPROVIDER', {
  workstation: 'channel',
  operations: ['channel.connections.create', 'channel.connections.test', 'channel.connections.enable', 'channel.syncruns.start', 'channel.operations.read', 'channel.operations.replay', 'extension.installations.read'],
  tables: ['channel.connection', 'channel.syncrun', 'channel.provideroperation'],
  event: 'channel.sync.completed',
});

test('MVPPROVIDER contains exactly the eleven workbook priority-one providers', () => {
  assert.deepEqual([...REQUIRED_PROVIDER_IDS].sort(), ['book', 'cake', 'charge', 'flower', 'foodvoucher', 'jdfresh', 'jdproduct', 'meal', 'movie', 'supplier', 'tmall']);
});
