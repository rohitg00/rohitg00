import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  aggregateMergedContributionOrganizations,
  aggregateOrganizations,
  composeEcosystemOrganizations,
  filterPublicContributionRows,
  normalizeRecentPublicActivity,
} from '../scripts/lib/github.mjs';

const contributionFixture = JSON.parse(
  await readFile(new URL('./fixtures/contributions.json', import.meta.url), 'utf8'),
);

test('private contribution repositories are removed before normalization', () => {
  const rows = filterPublicContributionRows(contributionFixture);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].repository.nameWithOwner, 'public-org/public-project');
  assert.equal(JSON.stringify(rows).includes('private-org'), false);
  assert.equal(Object.hasOwn(rows[0].repository, 'visibility'), false);
});

test('organization reach is built only from already public contribution rows', () => {
  const publicRows = filterPublicContributionRows(contributionFixture);
  const organizations = aggregateOrganizations(
    { commits: publicRows, pullRequests: [], issues: [], reviews: [] },
    'rohitg00',
    5,
  );

  assert.deepEqual(organizations.map(({ login }) => login), ['public-org']);
  assert.equal(organizations[0].activity, 8);
  assert.equal(organizations[0].collaborationActivity, 8);
  assert.equal(organizations[0].ecosystemStars, 1200);
});

test('recent activity accepts public events and excludes private events', () => {
  const activity = normalizeRecentPublicActivity(
    [
      {
        id: '1',
        type: 'PushEvent',
        public: true,
        repo: { name: 'public-org/public-project' },
        created_at: '2026-08-24T10:00:00Z',
        payload: { size: 2 },
      },
      {
        id: '2',
        type: 'PushEvent',
        public: false,
        repo: { name: 'private-org/private-project' },
        created_at: '2026-08-24T11:00:00Z',
        payload: { size: 5 },
      },
      {
        id: '3',
        type: 'PullRequestEvent',
        public: true,
        repo: { name: 'public-org/public-project' },
        created_at: '2026-08-24T12:00:00Z',
        payload: { action: 'opened' },
      },
    ],
    5,
  );

  assert.equal(activity.length, 2);
  assert.equal(activity[0].repository, 'public-org/public-project');
  assert.equal(activity[0].label, 'Opened a pull request');
  assert.equal(activity[1].label, 'Pushed 2 commits');
  assert.equal(JSON.stringify(activity).includes('private-org'), false);
});

test('zero-count public pushes are described without a misleading commit total', () => {
  const [activity] = normalizeRecentPublicActivity(
    [
      {
        id: '4',
        type: 'PushEvent',
        public: true,
        repo: { name: 'public-org/public-project' },
        created_at: '2026-08-24T13:00:00Z',
        payload: { size: 0 },
      },
    ],
    1,
  );

  assert.equal(activity.label, 'Pushed changes');
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
