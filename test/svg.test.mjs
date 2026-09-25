import assert from 'node:assert/strict';
import test from 'node:test';

import { finalizeSnapshot } from '../scripts/lib/model.mjs';
import { escapeXml, renderPublicBuilderSvg } from '../scripts/lib/svg.mjs';

const snapshot = finalizeSnapshot(
  {
    profile: {
      login: 'rohitg00',
      name: 'Rohit <Ghumare>',
      followers: 5958,
      originalRepositoryCount: 104,
    },
    metrics: {
      ownedStars: 95016,
      commits: 420,
      pullRequests: 92,
      issues: 31,
      reviews: 118,
      windowDays: 365,
    },
    ranking: {
      followerWorld: { position: 730 },
      topProjectWorld: { position: 110 },
    },
    topRepositories: [
      {
        name: 'ai-engineering-from-scratch',
        stars: 48052,
        language: 'Python',
      },
    ],
    recentActivity: [
      {
        label: 'Pushed 2 commits',
        repository: 'iii-hq/workers',
        occurredAt: '2026-08-24T10:00:00Z',
      },
    ],
    organizations: [
      {
        login: 'iii-hq',
        activity: 42,
        collaborationActivity: 36,
        ecosystemStars: 12000,
      },
    ],
    languages: [{ name: 'TypeScript', repositories: 22, stars: 30000 }],
  },
  null,
  new Date('2026-08-24T12:00:00Z'),
);

test('XML text is escaped', () => {
  assert.equal(escapeXml('<private & hidden>'), '&lt;private &amp; hidden&gt;');
});

test('SVG renders public signals without invalid numeric values', () => {
  const svg = renderPublicBuilderSvg(snapshot, [
    { date: '2026-08-23', builderIndex: snapshot.builderIndex.score - 1 },
    { date: '2026-08-24', builderIndex: snapshot.builderIndex.score },
  ]);

  assert.match(svg, /^<svg/);
  assert.match(svg, /PUBLIC DATA ONLY/);
  assert.match(svg, /ECOSYSTEM REACH/);
  assert.match(svg, /Rohit &lt;Ghumare&gt;/);
  assert.doesNotMatch(svg, /iii-hq\/workers|TOP PUBLIC WORK|RECENT PUBLIC ACTIVITY/);
  assert.doesNotMatch(svg, /undefined|NaN|<private/);
});

test('cached comparisons show their own date and growth uses a previous day', () => {
  const cached = {
    ...snapshot,
    ranking: {
      ...snapshot.ranking,
      creatorBenchmarks: { status: 'cached', measuredAt: '2026-08-01T00:00:00Z', positions: {} },
    },
  };
  for (const compact of [false, true]) {
    const svg = renderPublicBuilderSvg(cached, [
      { date: '2026-08-23', ownedStars: 94016, followers: 5800 },
      { date: '2026-08-24', ownedStars: 95016, followers: 5958 },
    ], { compact });
    assert.match(svg, /CACHED · 01 Aug 2026/);
    assert.match(svg, /\+1,000 since 23 Aug/);
    assert.doesNotMatch(svg, /LIVE|undefined|NaN/);
  }
});
