import { execFileSync } from 'node:child_process';

import { githubApi } from './github-cli.mjs';

const CONTRIBUTIONS_QUERY = `
  query PublicContributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository { visibility }
          contributions(first: 1) { totalCount }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository { visibility }
          contributions(first: 1) { totalCount }
        }
        issueContributionsByRepository(maxRepositories: 100) {
          repository { visibility }
          contributions(first: 1) { totalCount }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository { visibility }
          contributions(first: 1) { totalCount }
        }
      }
    }
  }
`;

const MERGED_PULL_REQUESTS_QUERY = `
  query MergedPullRequestOrganizations($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          id
          mergedAt
          repository {
            nameWithOwner
            url
            visibility
            stargazerCount
            owner { __typename login avatarUrl url }
          }
        }
      }
    }
  }
`;

export function resolveGitHubToken(environment = process.env) {
  const token = environment.GH_TOKEN || environment.GITHUB_TOKEN;
  if (token) {
    return token;
  }

  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error('Set GITHUB_TOKEN or authenticate the GitHub CLI before refreshing the profile.');
  }
}

async function githubRequest(path, token) {
  return githubApi(path, token);
}

async function githubGraphql(query, variables, token) {
  const body = await githubApi('graphql', token, { query, variables });
  if (body.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${body.errors.map(error => error.message).join('; ')}`);
  }
  return body.data;
}

async function paginate(path, token, maxPages = 10) {
  const items = [];
  const separator = path.includes('?') ? '&' : '?';

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await githubRequest(`${path}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) {
      throw new Error(`Expected a list from ${path.split('?')[0]}`);
    }
    items.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }

  return items;
}

export function sumPublicContributions(rows = []) {
  return rows
    .filter(({ repository }) => repository?.visibility === 'PUBLIC')
    .reduce((total, { contributions }) => total + contributions.totalCount, 0);
}

export function aggregateMergedContributionOrganizations(nodes, username, limit, options = {}) {
  const organizations = new Map();
  const priority = new Map(
    (options.priorityLogins ?? []).map((login, index) => [login.toLowerCase(), index]),
  );

  for (const node of nodes) {
    const repository = node?.repository;
    const owner = repository?.owner;
    if (
      !node?.mergedAt ||
      !repository?.nameWithOwner ||
      repository.visibility !== 'PUBLIC' ||
      owner?.__typename !== 'Organization' ||
      owner.login.toLowerCase() === username.toLowerCase()
    ) {
      continue;
    }

    const organization = organizations.get(owner.login) ?? {
      login: owner.login,
      url: owner.url,
      avatarUrl: owner.avatarUrl,
      mergedPullRequests: 0,
      repositories: new Map(),
    };
    organization.mergedPullRequests += 1;
    const previous = organization.repositories.get(repository.nameWithOwner);
    if (!previous || repository.stargazerCount > previous.stars) {
      organization.repositories.set(repository.nameWithOwner, {
        nameWithOwner: repository.nameWithOwner,
        stars: repository.stargazerCount,
        url: repository.url,
      });
    }
    organizations.set(owner.login, organization);
  }

  return [...organizations.values()]
    .map((organization) => {
      const repositories = [...organization.repositories.values()].sort((a, b) => b.stars - a.stars);
      const ecosystemStars = repositories.reduce((total, repository) => total + repository.stars, 0);
      return {
        login: organization.login,
        url: organization.url,
        avatarUrl: organization.avatarUrl,
        mergedPullRequests: organization.mergedPullRequests,
        ecosystemStars,
        repositoryCount: repositories.length,
        repositories: repositories.slice(0, 3),
      };
    })
    .sort(
      (a, b) => {
        const priorityA = priority.get(a.login.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        const priorityB = priority.get(b.login.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        return (
          priorityA - priorityB ||
          b.mergedPullRequests - a.mergedPullRequests ||
          b.ecosystemStars - a.ecosystemStars ||
          a.login.localeCompare(b.login)
        );
      },
    )
    .slice(0, limit);
}

async function avatarDataUri(url) {
  if (!url) return null;
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}s=64`, {
    headers: { Accept: 'image/*', 'User-Agent': 'rohitg00-profile-rank' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (!contentType?.startsWith('image/')) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 150_000) return null;
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

function organizationIdentity(organization) {
  const login = organization.login.toLowerCase();
  const brand = login.replace(/-(?:hq|experimental)$/, '');
  if (brand !== login) return `brand:${brand}`;
  return organization.avatarDataUri ?? organization.avatarUrl?.split('?')[0].toLowerCase() ?? login;
}

export function composeEcosystemOrganizations(contributed, affiliations, limit) {
  const marks = [];
  const identities = new Set();

  for (const organization of [...contributed, ...affiliations]) {
    const identity = organizationIdentity(organization);
    if (identities.has(identity)) continue;
    identities.add(identity);
    marks.push(organization);
    if (marks.length === limit) break;
  }

  return marks;
}

async function fetchFeaturedAffiliations(config, token) {
  return Promise.all(
    (config.featuredAffiliations ?? []).map(async (affiliation) => {
      const organization = await githubRequest(`/orgs/${encodeURIComponent(affiliation.login)}`, token);
      return {
        login: organization.login,
        displayName: affiliation.label ?? organization.name ?? organization.login,
        url: organization.html_url,
        avatarUrl: organization.avatar_url,
        avatarDataUri: await avatarDataUri(organization.avatar_url),
        relationship: affiliation.relationship,
      };
    }),
  );
}

async function searchMergedPullRequests(query, token, maxPages) {
  const nodes = [];
  let after = null;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await githubGraphql(
      MERGED_PULL_REQUESTS_QUERY,
      { query, after },
      token,
    );
    nodes.push(...data.search.nodes.filter(Boolean));
    if (!data.search.pageInfo.hasNextPage) break;
    after = data.search.pageInfo.endCursor;
  }

  return nodes;
}

async function fetchMergedContributionOrganizations(config, token) {
  const priorityLogins = config.contributedOrganizationPriority ?? [];
  const globalQuery = `is:pr is:merged is:public author:${config.username} archived:false sort:updated-desc`;
  const targetedQueries = priorityLogins.map(
    (login) => `is:pr is:merged is:public author:${config.username} org:${login} archived:false sort:updated-desc`,
  );
  const searches = await Promise.all([
    searchMergedPullRequests(globalQuery, token, config.mergedPullRequestSearchPages ?? 10),
    ...targetedQueries.map((query) =>
      searchMergedPullRequests(
        query,
        token,
        config.contributedOrganizationPrioritySearchPages ?? 2,
      ),
    ),
  ]);
  const nodes = [...new Map(
    searches
      .flat()
      .filter(Boolean)
      .map((node) => [node.id ?? `${node.repository?.nameWithOwner}:${node.mergedAt}`, node]),
  ).values()];

  const organizations = aggregateMergedContributionOrganizations(
    nodes,
    config.username,
    Number.MAX_SAFE_INTEGER,
    {
      priorityLogins,
    },
  );
  const selected = organizations.slice(0, config.contributedOrganizations ?? 7);
  const [contributed, affiliations] = await Promise.all([
    Promise.all(
      selected.map(async (organization) => ({
        ...organization,
        relationship: 'merged-public-prs',
        avatarDataUri: await avatarDataUri(organization.avatarUrl),
      })),
    ),
    fetchFeaturedAffiliations(config, token),
  ]);
  return composeEcosystemOrganizations(
    contributed,
    affiliations,
    config.contributedOrganizations ?? 7,
  );
}

async function searchPosition(query, token) {
  try {
    const result = await githubRequest(`/search/${query.type}?q=${encodeURIComponent(query.value)}&per_page=1`, token);
    return result.incomplete_results || !Number.isFinite(result.total_count) ? null : result.total_count + 1;
  } catch {
    return null;
  }
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export async function fetchPublicGitHubProfile(config, token, now = new Date()) {
  const windowStart = new Date(now.getTime() - config.activityWindowDays * 24 * 60 * 60 * 1000);
  const [profile, repositories, contributionData, ecosystemOrganizations] = await Promise.all([
    githubRequest(`/users/${encodeURIComponent(config.username)}`, token),
    paginate(`/users/${encodeURIComponent(config.username)}/repos?type=owner&sort=updated&direction=desc`, token),
    githubGraphql(
      CONTRIBUTIONS_QUERY,
      {
        login: config.username,
        from: windowStart.toISOString(),
        to: now.toISOString(),
      },
      token,
    ),
    fetchMergedContributionOrganizations(config, token),
  ]);

  if (!contributionData.user) {
    throw new Error(`GitHub user ${config.username} was not found.`);
  }

  const originalRepositories = repositories.filter((repository) => !repository.private && !repository.fork && !repository.archived);
  const topRepositories = [...originalRepositories]
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        Date.parse(b.pushed_at ?? b.updated_at) - Date.parse(a.pushed_at ?? a.updated_at),
    )
    .slice(0, config.topRepositories)
    .map((repository) => ({
      name: repository.name,
      nameWithOwner: repository.full_name,
      url: repository.html_url,
      stars: repository.stargazers_count,
    }));

  const contributions = contributionData.user.contributionsCollection;
  const followerPosition = await searchPosition(
    { type: 'users', value: `type:user followers:>${profile.followers}` },
    token,
  );
  const topProjectPosition = topRepositories[0]
    ? await searchPosition(
        { type: 'repositories', value: `is:public fork:false stars:>${topRepositories[0].stars}` },
        token,
      )
    : null;

  return {
    profile: {
      login: profile.login,
      name: profile.name,
      followers: profile.followers,
      originalRepositoryCount: originalRepositories.length,
    },
    metrics: {
      ownedStars: originalRepositories.reduce((total, repository) => total + repository.stargazers_count, 0),
      commits: sumPublicContributions(contributions.commitContributionsByRepository),
      pullRequests: sumPublicContributions(contributions.pullRequestContributionsByRepository),
      issues: sumPublicContributions(contributions.issueContributionsByRepository),
      reviews: sumPublicContributions(contributions.pullRequestReviewContributionsByRepository),
      windowDays: config.activityWindowDays,
      windowStart: isoDate(windowStart),
      windowEnd: isoDate(now),
    },
    ranking: {
      followerWorld: {
        position: followerPosition,
        measuredValue: profile.followers,
        source: 'GitHub Search',
        method: 'users with more followers plus one',
      },
      topProjectWorld: {
        position: topProjectPosition,
        measuredValue: topRepositories[0]?.stars ?? 0,
        repository: topRepositories[0]?.nameWithOwner ?? null,
        source: 'GitHub Search',
        method: 'repositories with more stars plus one',
      },
    },
    topRepositories,
    ecosystemOrganizations,
  };
}
