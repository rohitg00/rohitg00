import assert from 'node:assert/strict';
import test from 'node:test';

import { finalizeSnapshot } from '../scripts/lib/model.mjs';
import { escapeXml, renderPublicBuilderSvg } from '../scripts/lib/svg.mjs';
import { renderPublicWorkSvg } from '../scripts/lib/work-svg.mjs';
import { THEMES } from '../scripts/lib/theme.mjs';

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
    ecosystemOrganizations: [
      { login: 'iii-hq', mergedPullRequests: 36, relationship: 'merged-public-prs' },
    ],
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

test('cached creator ranks show their own date and growth uses a previous day', () => {
  const cached = {
    ...snapshot,
    ranking: {
      ...snapshot.ranking,
      gitRanksCreator: { status: 'cached', measuredAt: '2026-08-01T00:00:00Z', position: 80, stars: 103211, topPercent: .01, rankedProfiles: '1.6M', monthlyChange: 14 },
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

test('work panels handle missing language and contribution data without invalid output', () => {
  for (const compact of [false, true]) {
    const svg = renderPublicWorkSvg({ ...snapshot, techStack: ['Python', 'Rust'] }, { compact });
    assert.match(svg, /TECH STACK/);
    assert.match(svg, /No language breakdown reported/);
    assert.match(svg, /No public merged contributions found/);
    assert.doesNotMatch(svg, /undefined|NaN/);
  }
});

test('contribution panels identify all-time merged counts and PR diff totals', () => {
  for (const compact of [false, true]) {
    const svg = renderPublicWorkSvg({
      ...snapshot,
      recentContributions: [{
        nameWithOwner: 'public/repo', scope: 'all-time', mergedPullRequests: 206,
        additions: 1234, deletions: 56, stars: 100, forks: 10,
        lastMergedAt: '2026-09-04T00:00:00Z',
      }],
    }, { compact });
    assert.match(svg, /206 MERGED PRs \/ ALL TIME/);
    assert.match(svg, /SUM OF MERGED PR DIFFS/);
    assert.doesNotMatch(svg, /current calendar year|undefined|NaN/);
  }
});

test('dark panels preserve layout and content while changing the palette', () => {
  for (const compact of [false, true]) {
    const renderers = [
      theme => renderPublicBuilderSvg(snapshot, [], { compact, theme }),
      theme => renderPublicWorkSvg(snapshot, { compact, theme }),
    ];
    for (const render of renderers) {
      const light = render('light');
      const dark = render('dark');
      for (const color of [THEMES.dark.ink, THEMES.dark.blue, THEMES.dark.paper]) {
        assert.ok(dark.includes(color));
      }
      assert.deepEqual(dark.match(/<text\b[^>]*>.*?<\/text>/g), light.match(/<text\b[^>]*>.*?<\/text>/g));
      assert.deepEqual(dark.match(/\bd="[^"]*"/g), light.match(/\bd="[^"]*"/g));
      assert.equal(dark.match(/viewBox="[^"]*"/)[0], light.match(/viewBox="[^"]*"/)[0]);
      assert.doesNotMatch(dark, /undefined|NaN/);
    }
  }
});
