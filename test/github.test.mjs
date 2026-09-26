import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  aggregateMergedContributionOrganizations,
  composeEcosystemOrganizations,
  sumPublicContributions,
  languageShares,
  recentContributionRepositories,
  summarizeRepositoryContributions,
} from '../scripts/lib/github.mjs';

const contributionFixture = JSON.parse(
  await readFile(new URL('./fixtures/contributions.json', import.meta.url), 'utf8'),
);

test('contribution totals include only explicitly public repositories', () => {
  const rows = [
    ...contributionFixture,
    { repository: { visibility: 'INTERNAL' }, contributions: { totalCount: 200 } },
    { repository: {}, contributions: { totalCount: 300 } },
    { contributions: { totalCount: 400 } },
  ];
  assert.equal(sumPublicContributions(rows), 8);
  assert.equal(sumPublicContributions(), 0);
});

test('contributed organization marks require a merged public pull request', () => {
  const organizations = aggregateMergedContributionOrganizations(
    [
      {
        mergedAt: '2025-06-11T08:57:00Z',
        repository: {
          nameWithOwner: 'microsoft/mcp-for-beginners',
          visibility: 'PUBLIC',
          url: 'https://github.com/microsoft/mcp-for-beginners',
          stargazerCount: 1000,
          owner: {
            __typename: 'Organization',
            login: 'microsoft',
            avatarUrl: 'https://avatars.example/microsoft',
            url: 'https://github.com/microsoft',
          },
        },
      },
      {
        mergedAt: '2026-08-24T10:00:00Z',
        repository: {
          nameWithOwner: 'modelcontextprotocol/registry',
          visibility: 'PUBLIC',
          url: 'https://github.com/modelcontextprotocol/registry',
          stargazerCount: 5000,
          owner: {
            __typename: 'Organization',
            login: 'modelcontextprotocol',
            avatarUrl: 'https://avatars.example/mcp',
            url: 'https://github.com/modelcontextprotocol',
          },
        },
      },
      {
        mergedAt: null,
        repository: {
          nameWithOwner: 'anthropics/anthropic-cookbook',
          visibility: 'PUBLIC',
          url: 'https://github.com/anthropics/anthropic-cookbook',
          stargazerCount: 30000,
          owner: {
            __typename: 'Organization',
            login: 'anthropics',
            avatarUrl: 'https://avatars.example/anthropic',
            url: 'https://github.com/anthropics',
          },
        },
      },
    ],
    'rohitg00',
    5,
    {
      priorityLogins: ['microsoft', 'modelcontextprotocol'],
    },
  );

  assert.deepEqual(organizations.map(({ login }) => login), ['microsoft', 'modelcontextprotocol']);
  assert.equal(organizations[0].mergedPullRequests, 1);
});

test('merged PR organization aggregation rejects private and unknown visibility', () => {
  const nodes = ['PRIVATE', 'INTERNAL', undefined].map((visibility) => ({
    mergedAt: '2026-09-25T10:00:00Z',
    repository: {
      nameWithOwner: 'private-org/private-project', visibility,
      owner: { __typename: 'Organization', login: 'private-org' },
    },
  }));
  assert.deepEqual(aggregateMergedContributionOrganizations(nodes, 'rohitg00', 7), []);
});

test('ecosystem marks collapse duplicate logos and include public affiliations', () => {
  const marks = composeEcosystemOrganizations(
    [
      { login: 'iii-hq', avatarUrl: 'https://avatars.example/iii-hq?v=4' },
      { login: 'iii-experimental', avatarUrl: 'https://avatars.example/iii-experimental?v=4' },
    ],
    [
      {
        login: 'GoogleCloudPlatform',
        avatarUrl: 'https://avatars.example/google-cloud',
        relationship: 'Google Developer Expert (Cloud & GenAI)',
      },
    ],
    7,
  );

  assert.deepEqual(marks.map(({ login }) => login), ['iii-hq', 'GoogleCloudPlatform']);
});

function mergedContribution(name, at, visibility = 'PUBLIC') {
  return {
    id: `${name}:${at}`, mergedAt: at, additions: 12, deletions: 3,
    repository: {
      nameWithOwner: name, visibility, owner: { login: name.split('/')[0] },
      url: `https://github.com/${name}`, stargazerCount: 100, forkCount: 10,
      primaryLanguage: { name: 'Rust', color: '#dea584' },
    },
  };
}

test('recent contributions span all years and reject private, own and unmerged work', () => {
  const rows = [
    mergedContribution('public/older', '2026-01-02T00:00:00Z'),
    mergedContribution('public/newer', '2026-09-24T00:00:00Z'),
    mergedContribution('public/newer', '2026-09-25T00:00:00Z'),
    mergedContribution('rohitg00/own', '2026-09-25T01:00:00Z'),
    mergedContribution('hidden/repo', '2026-09-25T02:00:00Z', 'PRIVATE'),
    mergedContribution('unknown/repo', '2026-09-25T02:00:00Z', null),
    mergedContribution('public/lastyear', '2025-12-30T00:00:00Z'),
    mergedContribution('public/open', null),
  ];
  assert.deepEqual(recentContributionRepositories(rows, 'rohitg00', 5).map(repo => repo.nameWithOwner), ['public/newer', 'public/older', 'public/lastyear']);
  assert.deepEqual(recentContributionRepositories(rows, 'rohitg00', 1).map(repo => repo.nameWithOwner), ['public/newer']);
});

test('contribution counts use the full search count while incomplete line totals remain unavailable', () => {
  const nodes = [mergedContribution('public/repo', '2025-09-20T00:00:00Z'), mergedContribution('public/repo', '2026-09-25T00:00:00Z')];
  const complete = summarizeRepositoryContributions(nodes[0].repository, { nodes, totalCount: 2 });
  assert.equal(complete.scope, 'all-time');
  assert.equal(complete.mergedPullRequests, 2);
  assert.equal(complete.additions, 24);
  assert.equal(complete.deletions, 6);
  assert.equal(complete.lastMergedAt, '2026-09-25T00:00:00Z');
  const partial = summarizeRepositoryContributions(nodes[0].repository, { nodes, totalCount: 1020 });
  assert.equal(partial.mergedPullRequests, 1020);
  assert.equal(partial.additions, null);
  assert.equal(partial.deletions, null);
  const privateNode = mergedContribution('hidden/repo', '2026-09-25T00:00:00Z', 'PRIVATE');
  assert.equal(summarizeRepositoryContributions(privateNode.repository, { nodes: [privateNode], totalCount: 1 }), null);
});

test('duplicate PRs cannot inflate diff totals or make partial results look complete', () => {
  const node = mergedContribution('public/repo', '2026-09-25T00:00:00Z');
  const complete = summarizeRepositoryContributions(node.repository, { nodes: [node, node], totalCount: 1 });
  assert.equal(complete.additions, 12);
  assert.equal(complete.deletions, 3);
  const partial = summarizeRepositoryContributions(node.repository, { nodes: [node, node], totalCount: 2 });
  assert.equal(partial.mergedPullRequests, 2);
  assert.equal(partial.additions, null);
  assert.equal(partial.deletions, null);
});

test('language shares use repository code size, preserve colors and handle empty repositories', () => {
  assert.deepEqual(languageShares({ totalSize: 1000, edges: [
    { size: 600, node: { name: 'TypeScript', color: '#3178c6' } },
    { size: 400, node: { name: 'Shell', color: null } },
  ] }), [
    { name: 'TypeScript', color: '#3178c6', percentage: 60 },
    { name: 'Shell', color: '#777777', percentage: 40 },
  ]);
  assert.deepEqual(languageShares({ totalSize: 0, edges: [] }), []);
});
