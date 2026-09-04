import { array, literal, maxLength, null as nullSchema, regex, strictObject, string, union } from 'zod/mini';
import { unsigned, version } from './Primitives';

const hash = string().check(regex(/^[0-9a-f]{64}$/));
const items = array(strictObject({ id: string(), expectedVersion: unsigned })).check(maxLength(200));
const action = literal(['publish', 'unpublish']);

export const catalogListingsBatchInput = union([strictObject({ phase: literal('preview'), items, action }), strictObject({ phase: literal('execute'), items, action, previewHash: hash })]);

export const catalogListingsBatchOutput = strictObject({
  phase: literal(['preview', 'executed']),
  action,
  previewHash: hash,
  items: array(
    strictObject({
      id: string(),
      state: literal(['ready', 'succeeded', 'failed']),
      status: union([literal(['published', 'unpublished']), nullSchema()]),
      version: union([version, nullSchema()]),
      error: union([string(), nullSchema()]),
      gaps: array(string()),
    })
  ),
  count: unsigned,
  failed: unsigned,
});
