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
