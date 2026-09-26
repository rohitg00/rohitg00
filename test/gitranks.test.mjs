import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGitRanksCreator, refreshGitRanksCreator } from '../scripts/lib/gitranks.mjs';

function streamedCard({ change = '↑14', stars = '103,211', description = 'Counts stars on repositories owned by the profile.' } = {}) {
  const tree = ['$', 'div', null, { 'data-slot': 'card', children: [
    ['Position: ', '80', ['$', 'span', null, { children: ['/', ['$', '$L8', null, { href: '/by/stars/1', children: '1.6M' }]] }]],
    ['Top ', .01, '% of all ranked profiles'],
    ['$', 'span', null, { children: ['This month change: ', ['$', 'span', null, { children: change }]] }],
    ['Total ', 'star', 's: ', stars],
    description,
  ] }];
  const record = `52:${JSON.stringify(tree)}\n`;
  return `<script>self.__next_f.push(${JSON.stringify([1, record.slice(0, 100)])})</script><script>self.__next_f.push(${JSON.stringify([1, record.slice(100)])})</script>`;
}

test('GitRanks parser reads its reported creator rank, cohort, percentile, movement and stars', () => {
  const unrelated = streamedCard({ stars: '439,300', description: 'Counts stars on repos owned by others.' });
  assert.deepEqual(parseGitRanksCreator(unrelated + streamedCard()), {
    position: 80, rankedProfiles: '1.6M', topPercent: .01, monthlyChange: 14, stars: 103211,
  });
});

test('GitRanks movements retain direction and missing movements remain unknown', () => {
  assert.equal(parseGitRanksCreator(streamedCard({ change: '↓1,002' })).monthlyChange, -1002);
  assert.equal(parseGitRanksCreator(streamedCard({ change: '' })).monthlyChange, null);
});

test('malformed creator rows do not hide a subsequent valid card', () => {
  const record = '51:not JSON: Counts stars on repositories owned by the profile.\n';
  const malformed = `<script>self.__next_f.push(${JSON.stringify([1, record])})</script>`;
  assert.deepEqual(parseGitRanksCreator(malformed + streamedCard()), parseGitRanksCreator(streamedCard()));
  assert.throws(() => parseGitRanksCreator(malformed), /could not be verified/);
});

test('incomplete or unrelated rankings cannot substitute for creator data', () => {
  assert.throws(() => parseGitRanksCreator(streamedCard({ stars: '' })), /could not be verified/);
  assert.throws(() => parseGitRanksCreator(streamedCard({ description: 'Follower rank' })), /could not be verified/);
  assert.throws(() => parseGitRanksCreator('<html>Service unavailable</html>'), /could not be verified/);
});

test('failed GitRanks refresh keeps the original measurement date and reports cached or unavailable', async () => {
  const previous = { position: 80, stars: 103211, measuredAt: '2026-09-25T13:00:00Z' };
  const fail = async () => { throw new Error('Profile unavailable'); };
  const cached = await refreshGitRanksCreator('rohitg00', previous, new Date(), fail);
  assert.deepEqual(cached, { ...previous, status: 'cached' });
  const unavailable = await refreshGitRanksCreator('rohitg00', null, new Date(), fail);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.position, undefined);
});

test('failed refreshes cannot turn missing or unverified measurements into cached rankings', async () => {
  const fail = async () => { throw new Error('Profile unavailable'); };
  for (const previous of [
    { status: 'unavailable', measuredAt: null },
    { position: null, measuredAt: '2026-09-25T13:00:00Z' },
    { position: Infinity, measuredAt: '2026-09-25T13:00:00Z' },
    { position: 0, measuredAt: '2026-09-25T13:00:00Z' },
    { position: 80, measuredAt: null },
    { position: 80, measuredAt: 'invalid' },
  ]) {
    assert.deepEqual(await refreshGitRanksCreator('rohitg00', previous, new Date(), fail), {
      status: 'unavailable', measuredAt: null,
    });
  }
});
