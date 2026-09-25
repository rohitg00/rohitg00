import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  aggregateMergedContributionOrganizations,
  composeEcosystemOrganizations,
  sumPublicContributions,
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
