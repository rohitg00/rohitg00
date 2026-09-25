import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBuilderIndex, finalizeSnapshot, logarithmicScore } from '../scripts/lib/model.mjs';

const rawSnapshot = {
  profile: {
    login: 'rohitg00',
    name: 'Rohit Ghumare',
    followers: 6000,
    originalRepositoryCount: 100,
  },
  metrics: {
    ownedStars: 95000,
    commits: 600,
    pullRequests: 150,
    issues: 80,
    reviews: 200,
    windowDays: 365,
  },
  ranking: {
    followerWorld: { position: 700 },
    topProjectWorld: { position: 120 },
  },
  topRepositories: [],
};

test('logarithmic scoring is bounded and monotonic', () => {
  assert.equal(logarithmicScore(0, 100), 0);
  assert.ok(logarithmicScore(50, 100) < logarithmicScore(100, 100));
  assert.equal(logarithmicScore(1000, 100), 100);
});

test('Builder Index is transparent, bounded, and does not invent a global rank', () => {
  const index = calculateBuilderIndex(rawSnapshot);

  assert.ok(index.score > 0 && index.score <= 100);
  assert.equal(index.globalRank, null);
  assert.equal(index.model.version, '1.0.0');
  assert.deepEqual(Object.keys(index.values), [
    'creation',
    'shipping',
    'collaboration',
    'maintenance',
    'community',
  ]);
});

test('unchanged public data preserves its generation timestamp', () => {
  const first = finalizeSnapshot(rawSnapshot, null, new Date('2026-08-24T10:00:00Z'));
  const second = finalizeSnapshot(rawSnapshot, first, new Date('2026-08-24T11:00:00Z'));

  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.generatedAt, first.generatedAt);
});

test('creator measurement timestamps are retained without changing the content fingerprint', () => {
  const creator = {
    position: 80, rankedProfiles: '1.6M', topPercent: .01, monthlyChange: 14,
    stars: 103211, status: 'fresh', source: 'https://gitranks.com/profile/rohitg00/ranks',
    measuredAt: '2026-09-25T13:00:00Z',
  };
  const raw = { ...rawSnapshot, ranking: { ...rawSnapshot.ranking, gitRanksCreator: creator } };
  const first = finalizeSnapshot(raw, null, new Date('2026-09-25T13:00:00Z'));
  const refreshedCreator = { ...creator, measuredAt: '2026-09-25T13:30:00Z' };
  const refreshed = { ...raw, ranking: { ...raw.ranking, gitRanksCreator: refreshedCreator } };
  const before = structuredClone(refreshed);
  const second = finalizeSnapshot(refreshed, first, new Date('2026-09-25T13:30:00Z'));

  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.generatedAt, first.generatedAt);
  assert.deepEqual(second.ranking.gitRanksCreator, refreshedCreator);
  assert.deepEqual(refreshed, before);
  assert.deepEqual(first.ranking.gitRanksCreator, creator);

  for (const change of [
    { position: 79 }, { rankedProfiles: '1.7M' }, { topPercent: .02 }, { monthlyChange: 15 },
    { stars: 103212 }, { status: 'cached' }, { source: 'https://gitranks.com/new-source' },
  ]) {
    const changed = finalizeSnapshot({ ...raw, ranking: { ...raw.ranking, gitRanksCreator: { ...creator, ...change } } }, first);
    assert.notEqual(changed.fingerprint, first.fingerprint);
  }
  const otherMeasurement = finalizeSnapshot({ ...raw, measuredAt: creator.measuredAt }, first);
  assert.notEqual(otherMeasurement.fingerprint, first.fingerprint);
});

test('country measurement dates do not cause content changes but ranks and cached scores do', () => {
  const benchmark = { status: 'fresh', measuredAt: '2026-09-25T00:00:00Z', measuredValue: 95000, positions: { india: { label: 'India', position: 1 } } };
  const raw = { ...rawSnapshot, ranking: { ...rawSnapshot.ranking, creatorBenchmarks: benchmark } };
  const first = finalizeSnapshot(raw, null);
  const refreshed = { ...benchmark, measuredAt: '2026-09-26T00:00:00Z' };
  const second = finalizeSnapshot({ ...raw, ranking: { ...raw.ranking, creatorBenchmarks: refreshed } }, first);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.generatedAt, second.generatedAt);
  assert.deepEqual(second.ranking.creatorBenchmarks, refreshed);
  assert.equal(benchmark.measuredAt, '2026-09-25T00:00:00Z');
  for (const change of [{ status: 'cached' }, { measuredValue: 98000 }, { positions: { india: { label: 'India', position: 2 } } }]) {
    const changed = finalizeSnapshot({ ...raw, ranking: { ...raw.ranking, creatorBenchmarks: { ...benchmark, ...change } } }, first);
    assert.notEqual(changed.fingerprint, first.fingerprint);
  }
});
