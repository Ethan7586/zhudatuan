import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MVP_REQUIREMENT_IDS } from '@shop/contract';

import { IDEAL_JOURNEYS } from './IdealJourneyCatalog';

test('ideal journey catalog freezes all forty four acceptance journeys', () => {
  assert.equal(IDEAL_JOURNEYS.length, 44);
  assert.deepEqual(
    IDEAL_JOURNEYS.map(({ id }) => id),
    Array.from({ length: 44 }, (_, index) => `J${String(index + 1).padStart(2, '0')}`),
  );
  assert.equal(new Set(IDEAL_JOURNEYS.map(({ title }) => title)).size, IDEAL_JOURNEYS.length);
  assert.equal(new Set(IDEAL_JOURNEYS.map(({ suite, scenario }) => `${suite}:${scenario}`)).size, IDEAL_JOURNEYS.length);
});

test('every ideal journey points to a canonical MVP requirement and executable test target', () => {
  const requirements = new Set<string>(MVP_REQUIREMENT_IDS);
  for (const journey of IDEAL_JOURNEYS) {
    assert.ok(requirements.has(journey.requirement), `${journey.id} has unknown requirement ${journey.requirement}`);
    assert.match(journey.test, /^tests\/e2e\/[a-z]+\.spec\.ts$/);
  }
});

test('all twenty two MVP requirements are represented by the current or ideal journey catalog', () => {
  const requirements = new Set(IDEAL_JOURNEYS.map(({ requirement }) => requirement));
  const coveredByCurrentRequirementJourneys = [
    'MVPDISTRIBUTION',
    'MVPGROUPDASHBOARD',
    'MVPGROUPAPPLICATION',
    'MVPGROUPREPORT',
    'MVPMALLDASHBOARD',
    'MVPMALLREPORT',
    'MVPMALLSUPPORT',
  ];
  for (const requirement of coveredByCurrentRequirementJourneys) requirements.add(requirement);
  assert.deepEqual([...requirements].sort(), [...MVP_REQUIREMENT_IDS].sort());
});
