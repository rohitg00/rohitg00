# Public ranking methodology

The profile card separates direct world positions from a transparent activity score.

## Direct world positions

Follower rank is calculated as one plus the number of public GitHub user accounts with more followers. Top project rank is one plus the number of public, non-fork repositories with more stars than the profile's most-starred original repository. Both counts come from GitHub Search at refresh time.

## Creator profile geography benchmarks

The World, India, USA, UK, and China comparisons use the Stars leaderboards from the open-source [GitRanks UI](https://github.com/gitranks/gitranks-ui). These are score insertion benchmarks, not the official GitRanks positions of this account. The profile score sums stars on public, non-fork, non-archived repositories; GitRanks profiles may use a different repository inclusion policy.

Every position uses Rohit's same current owned-star score. It is one plus the number of profiles above that score on the corresponding GitRanks Stars leaderboard. Country values are comparison benchmarks, not claims that the profile resides in every country. They are explicitly not follower ranks.

The updater reads the first public leaderboard pages through Jina Reader, requesting an uncached response. Positions are reported only when the returned ranks start at one, are continuous, and include the score boundary. Scores below the fetched page have no verified position. Upstream leaderboards may lag GitHub.

Each successful comparison records its measurement time. If a refresh fails, the card labels the previous result as cached and displays its original date and score. Without a prior result, it shows unavailable comparisons.

## Builder Index

The Builder Index is a 0 to 100 score. It is not presented as a global rank because a global rank requires a reproducible comparison corpus.

Each input uses logarithmic scaling so one large number cannot overwhelm the full profile:

| Component | Weight | Public signal | Reference cap |
| --- | ---: | --- | ---: |
| Creation | 35% | Stars on original, owned repositories | 100,000 |
| Shipping | 25% | Commits in the trailing 365 days | 1,000 |
| Collaboration | 20% | Pull requests and reviews in the trailing 365 days | 250 PRs, 500 reviews |
| Maintenance | 10% | Issues opened in the trailing 365 days | 250 |
| Community | 10% | Followers | 10,000 |

The reference caps are normalization anchors, not claims about the global population. The model version and all component values are stored in `data/public-profile.json`.

## Privacy boundary

The collector uses public profile, repository, search, and contribution data. Contribution groups are accepted only when the repository visibility is `PUBLIC`.

The generator does not use GitHub's blended contribution totals because an authenticated response can include private activity. It does not store restricted contribution counts, private repository names, private organization names, commit messages, pull request titles, or issue titles.

Ecosystem marks combine organizations with at least one merged public pull request authored by the profile and public professional affiliations configured in `config/profile.json`. Searches explicitly request public repositories; the collector also rejects rows without `PUBLIC` visibility. Affiliation marks state their relationship in the SVG title. Duplicate brands are collapsed, verified priority ecosystems are shown first, and remaining marks are ordered by merged-pull-request depth. The card shows seven marks.

GitHub returns at most 100 repositories for each contribution category. The card labels the 365-day figures as public signals rather than lifetime totals.

## Freshness

The repository workflow checks at minutes 17 and 47 of every hour once merged into the default branch and enabled. It also refreshes when generator code or configuration changes, and supports a manual Actions run. Each run installs locked dependencies, runs tests, collects public data using `gh api`, rebuilds both banners, and commits only generated profile files with `git`. It uses the repository's built-in `GITHUB_TOKEN` through `GH_TOKEN`; no personal token is required for the public data. Forks and non-default branches cannot run the publishing job.

GitHub Actions schedules and GitHub's image cache can delay visible updates.

Growth compares with the most recent saved snapshot from an earlier UTC day. The comparison date is shown next to the change. The 365-day activity window rolls forward, so its counts may decrease even when new activity occurs.

The README selects a separate compact PNG below 600px. Both PNGs are generated from the same snapshot with `npm run render`. SVG intermediates are generated locally and are not committed. The README displays these images directly, so its design matches the generated banner. Refreshes update the images and data without rewriting the README.

## Refresh locally

Install Node.js 20 or newer, GitHub CLI, and `rsvg-convert` (the `librsvg` package on macOS or `librsvg2-bin` on Ubuntu). Then run from this repository:

```sh
gh auth login
npm ci
npm run update
npm run verify
```

The updater reads through GitHub CLI and writes local files. It does not push. Once the workflow is on `master`, a manual refresh can be requested with `gh workflow run update-public-profile.yml --repo rohitg00/rohitg00`. The separate pull-request check runs tests and renders the saved snapshot without API credentials.
