import assert from 'node:assert/strict';
import test from 'node:test';

import { renderReadme } from '../scripts/lib/readme.mjs';

const template = `# Profile
<!-- PUBLIC_PROFILE_TOP_REPOSITORIES:START -->
old repositories
<!-- PUBLIC_PROFILE_TOP_REPOSITORIES:END -->
<!-- PUBLIC_PROFILE_RECENT_ACTIVITY:START -->
old activity
<!-- PUBLIC_PROFILE_RECENT_ACTIVITY:END -->
`;

test('README renderer moves repositories and activity into GitHub-native sections', () => {
  const readme = renderReadme(template, {
    topRepositories: [
      {
        name: 'public-project',
        description: 'A public <project>',
        url: 'https://github.com/example/public-project',
        stars: 1200,
        forks: 80,
        language: 'TypeScript',
        updatedAt: '2026-08-24T10:00:00Z',
      },
    ],
    recentActivity: [
      {
        repository: 'public-org/public-project',
        label: 'Opened a pull request',
        url: 'https://github.com/public-org/public-project',
        occurredAt: '2026-08-24T12:00:00Z',
      },
    ],
  });

  assert.match(readme, /public-project/);
  assert.match(readme, /Opened a pull request/);
  assert.match(readme, /A public &lt;project&gt;/);
  assert.doesNotMatch(readme, /old repositories|old activity/);
});
