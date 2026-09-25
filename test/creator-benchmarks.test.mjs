import assert from 'node:assert/strict';
import test from 'node:test';

import { benchmarkPosition, fetchCreatorBenchmarks, parseLeaderboardRows, refreshCreatorBenchmarks } from '../scripts/lib/creator-benchmarks.mjs';

const countries = [{ key: 'uk', label: 'UK', path: 'United Kingdom' }];
const table = `| Rank | Login | Location | Stars |
| --- | --- | --- | --- |
| 1 | builder | UK | 104,399 |
| 2↑1 | creator | UK | 83,870 |`;

test('leaderboard rows preserve ranks, movements, and complete numeric scores', () => {
  assert.deepEqual(parseLeaderboardRows(table), [{ rank: 1, score: 104399 }, { rank: 2, score: 83870 }]);
  const invalid = parseLeaderboardRows(table.replace('104,399', '104K'));
  assert.equal(benchmarkPosition(invalid, 110000), null);
});

test('country comparisons require continuous ranks and count all scores above the boundary', () => {
  const rows = [{ rank: 1, score: 500 }, { rank: 2, score: 300 }, { rank: 3, score: 300 }];
  assert.equal(benchmarkPosition(rows, 501), 1);
  assert.equal(benchmarkPosition(rows, 300), 2);
  assert.equal(benchmarkPosition(rows, 299), null);
  assert.equal(benchmarkPosition([{ rank: 1, score: 500 }, { rank: 2, score: 200 }, { rank: 3, score: 400 }], 300), 3);
  for (const invalid of [[], [{ rank: 2, score: 300 }], [...rows, { rank: 5, score: 100 }],
    [{ rank: 1, score: NaN }]]) {
    assert.equal(benchmarkPosition(invalid, 500), null);
  }
  assert.equal(benchmarkPosition(rows, NaN), null);
});

test('World and configured country comparisons use one score and uncached source pages', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push(url);
    assert.equal(options.headers['X-No-Cache'], 'true');
    return { ok: true, text: async () => table };
  };
  const result = await fetchCreatorBenchmarks(100000, countries, new Date('2026-09-26T00:00:00Z'), fetcher);
  assert.deepEqual(requests, [
    'https://r.jina.ai/http://gitranks.com/by/stars/1',
    'https://r.jina.ai/http://gitranks.com/country/United%20Kingdom/stars/1',
  ]);
  assert.equal(result.measuredValue, 100000);
  assert.equal(result.measuredAt, '2026-09-26T00:00:00.000Z');
  assert.equal(result.positions.world.position, 2);
  assert.equal(result.positions.uk.position, 2);
  assert.equal(result.positions.uk.source, 'https://gitranks.com/country/United%20Kingdom/stars/1');
  assert.equal(result.status, 'fresh');
});

test('failed or incomplete leaderboards cannot publish unverified positions', async () => {
  await assert.rejects(fetchCreatorBenchmarks(1, countries, new Date(), async () => ({ ok: true, text: async () => table })), /boundary/);
  await assert.rejects(fetchCreatorBenchmarks(100000, countries, new Date(), async () => ({ ok: false, status: 503 })), /503/);
});

test('failed refreshes retain verified comparisons with the original score and date', async () => {
  const previous = {
    status: 'fresh', measuredValue: 98124, measuredAt: '2026-09-25T00:00:00Z',
    positions: { world: { label: 'World', position: 88 }, uk: { label: 'UK', position: 3 } },
  };
  const fail = async () => { throw new Error('Unavailable'); };
  const cached = await refreshCreatorBenchmarks(110000, countries, previous, new Date(), fail);
  assert.deepEqual(cached, { ...previous, status: 'cached' });
  for (const invalid of [null, { status: 'unavailable', measuredAt: null },
    { ...previous, measuredAt: null }, { ...previous, measuredValue: NaN },
    { ...previous, positions: { world: { position: 88 } } }]) {
    const result = await refreshCreatorBenchmarks(110000, countries, invalid, new Date(), fail);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.measuredValue, null);
    assert.equal(result.measuredAt, null);
    assert.deepEqual(result.positions, { world: { label: 'World', position: null }, uk: { label: 'UK', position: null } });
  }
});
