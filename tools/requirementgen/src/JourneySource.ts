import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface JourneyDefinition {
  readonly id: `J${number}`;
  readonly title: string;
  readonly requirements: readonly `MVP${Uppercase<string>}`[];
  readonly suite: string;
  readonly scenario: string;
  readonly assertions: readonly string[];
}

export interface JourneySource {
  readonly version: 1;
  readonly count: 44;
  readonly journeys: readonly JourneyDefinition[];
  readonly bytes: Uint8Array;
}

export async function loadJourneySource(root: string): Promise<JourneySource> {
  const bytes = await readFile(resolve(root, 'config/journeys.yml'));
  const document = parse(bytes.toString('utf8')) as Partial<JourneySource>;
  if (document.version !== 1 || document.count !== 44 || document.journeys?.length !== 44) throw new Error('JOURNEY_SOURCE_SHAPE_INVALID');
  const journeys = Object.freeze(document.journeys.map((journey, index) => validate(journey, index)));
  if (new Set(journeys.map(({ title }) => title)).size !== journeys.length) throw new Error('JOURNEY_TITLE_DUPLICATE');
  if (new Set(journeys.map(({ suite, scenario }) => `${suite}:${scenario}`)).size !== journeys.length) throw new Error('JOURNEY_SCENARIO_DUPLICATE');
  return Object.freeze({ version: 1, count: 44, journeys, bytes });
}

function validate(journey: JourneyDefinition, index: number): JourneyDefinition {
  const expected = `J${String(index + 1).padStart(2, '0')}`;
  if (journey.id !== expected || !journey.title || !/^[a-z]+(?:-[a-z]+)*$/.test(journey.suite) || !/^[a-z]+(?: [a-z]+)*$/.test(journey.scenario)) {
    throw new Error(`JOURNEY_IDENTITY_INVALID:${journey.id}:${expected}`);
  }
  if (!Array.isArray(journey.requirements) || journey.requirements.length === 0 || new Set(journey.requirements).size !== journey.requirements.length) throw new Error(`JOURNEY_REQUIREMENT_INVALID:${journey.id}`);
  if (!Array.isArray(journey.assertions) || journey.assertions.length < 2 || journey.assertions.some((assertion) => typeof assertion !== 'string' || assertion.length === 0)) throw new Error(`JOURNEY_ASSERTION_INVALID:${journey.id}`);
  return Object.freeze({ ...journey, requirements: Object.freeze([...journey.requirements]), assertions: Object.freeze([...journey.assertions]) });
}
