import assert from 'node:assert/strict';
import test from 'node:test';

import { finalizeSnapshot } from '../scripts/lib/model.mjs';
import { updateHistory } from '../scripts/update-profile.mjs';

function snapshot(at, scoreInput = 100) {
  return finalizeSnapshot(
    {
      profile: { login: 'rohitg00', followers: scoreInput, originalRepositoryCount: 1 },
      metrics: {
        ownedStars: scoreInput,
        commits: scoreInput,
        pullRequests: scoreInput,
        issues: scoreInput,
        reviews: scoreInput,
        windowDays: 365,
      },
      ranking: {
        followerWorld: { position: 100 },
        topProjectWorld: { position: 100 },
      },
      topRepositories: [],
    },
    null,
    new Date(at),
  );
}

test('history keeps one current entry per day and skips unchanged refreshes', () => {
  const first = snapshot('2026-08-24T10:00:00Z');
  const firstHistory = updateHistory([], first, true);
  const unchangedHistory = updateHistory(firstHistory, first, false);
  const changedSameDay = updateHistory(firstHistory, snapshot('2026-08-24T14:00:00Z', 150), true);

  assert.equal(firstHistory.length, 1);
  assert.deepEqual(unchangedHistory, firstHistory);
  assert.equal(changedSameDay.length, 1);
  assert.notEqual(changedSameDay[0].builderIndex, firstHistory[0].builderIndex);
});
