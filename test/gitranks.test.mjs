import assert from 'node:assert/strict';
import test from 'node:test';

import { benchmarkPosition, parseLeaderboardRows, refreshCreatorBenchmarks } from '../scripts/lib/gitranks.mjs';

test('GitRanks markdown rows retain rank and creator score only', () => {
  const rows = parseLeaderboardRows(`
| Rank | Login | Location | Stars |
| --- | --- | --- | --- |
| 1 | [builder](https://gitranks.com/profile/builder) | India | 104,399 |
| 2↑1 | [creator](https://gitranks.com/profile/creator) | India | 83,870 |
`);

  assert.deepEqual(rows, [
    { rank: 1, score: 104399 },
    { rank: 2, score: 83870 },
  ]);
});

test('benchmark ranks require a continuous first page and an observed score boundary', () => {
  const rows = [{ rank: 1, score: 500 }, { rank: 2, score: 300 }];
  assert.equal(benchmarkPosition(rows, 300), 2);
  assert.equal(benchmarkPosition(rows, 501), 1);
  assert.equal(benchmarkPosition(rows, 299), null);
  assert.equal(benchmarkPosition([{ rank: 2, score: 300 }], 500), null);
  assert.equal(benchmarkPosition([], 500), null);
});

test('failed benchmark refresh retains the old score and date with a cached label', async () => {
  const previous = { measuredAt: '2026-08-29T08:43:46.542Z', measuredValue: 98124, positions: { world: { position: 88 } } };
  const fail = async () => { throw new Error('Leaderboard unavailable'); };
  const cached = await refreshCreatorBenchmarks(106043, [], previous, new Date(), fail);
  assert.equal(cached.status, 'cached');
  assert.equal(cached.measuredAt, previous.measuredAt);
  assert.equal(cached.measuredValue, 98124);
  assert.deepEqual(cached.positions, previous.positions);
  const unavailable = await refreshCreatorBenchmarks(106043, [], null, new Date(), fail);
  assert.equal(unavailable.status, 'unavailable');
  assert.deepEqual(unavailable.positions, {});
});
