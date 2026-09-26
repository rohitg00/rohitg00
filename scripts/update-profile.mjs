import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchPublicGitHubProfile, resolveGitHubToken } from './lib/github.mjs';
import { refreshGitRanksCreator } from './lib/gitranks.mjs';
import { refreshCreatorBenchmarks } from './lib/creator-benchmarks.mjs';
import { finalizeSnapshot } from './lib/model.mjs';
import { writeProfileAssets } from './lib/assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'config/profile.json');
const snapshotPath = resolve(root, 'data/public-profile.json');
const historyPath = resolve(root, 'data/public-profile-history.json');

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function historyEntry(snapshot) {
  return {
    date: snapshot.generatedAt.slice(0, 10),
    builderIndex: snapshot.builderIndex.score,
    followerRank: snapshot.ranking.followerWorld.position,
    topProjectRank: snapshot.ranking.topProjectWorld.position,
    gitRanksCreatorRank: snapshot.ranking.gitRanksCreator?.position ?? null,
    creatorBenchmarkRanks: Object.fromEntries(
      Object.entries(snapshot.ranking.creatorBenchmarks?.positions ?? {}).map(([key, value]) => [key, value.position]),
    ),
    followers: snapshot.profile.followers,
    ownedStars: snapshot.metrics.ownedStars,
    commits: snapshot.metrics.commits,
    pullRequests: snapshot.metrics.pullRequests,
    issues: snapshot.metrics.issues,
    reviews: snapshot.metrics.reviews,
  };
}

export function updateHistory(history, snapshot, changed, limit = 365) {
  if (!changed && history.length) {
    return history;
  }

  const entry = historyEntry(snapshot);
  const next = [...history];
  const last = next.at(-1);
  if (last?.date === entry.date) {
    next[next.length - 1] = entry;
  } else {
    next.push(entry);
  }
  return next.slice(-limit);
}

async function main() {
  const [config, previousSnapshot, previousHistory] = await Promise.all([
    readJson(configPath),
    readJson(snapshotPath),
    readJson(historyPath, []),
  ]);
  const token = resolveGitHubToken();
  const now = new Date();
  const publicProfile = await fetchPublicGitHubProfile(config, token, now);
  [publicProfile.ranking.gitRanksCreator, publicProfile.ranking.creatorBenchmarks] = await Promise.all([
    refreshGitRanksCreator(config.username, previousSnapshot?.ranking.gitRanksCreator, now),
    refreshCreatorBenchmarks(
      publicProfile.metrics.ownedStars,
      config.creatorBenchmarkCountries,
      previousSnapshot?.ranking.creatorBenchmarks,
      now,
    ),
  ]);
  const snapshot = finalizeSnapshot(publicProfile, previousSnapshot, now);
  const changed = snapshot.fingerprint !== previousSnapshot?.fingerprint;
  const history = updateHistory(previousHistory, snapshot, changed);

  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeProfileAssets(root, snapshot, history);
  await Promise.all([
    writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`),
    writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`),
  ]);

  console.log(
    JSON.stringify({
      changed,
      generatedAt: snapshot.generatedAt,
      builderIndex: snapshot.builderIndex.score,
      followerRank: snapshot.ranking.followerWorld.position,
      topProjectRank: snapshot.ranking.topProjectWorld.position,
      gitRanksCreator: snapshot.ranking.gitRanksCreator,
      creatorBenchmarks: snapshot.ranking.creatorBenchmarks,
      publicSignals: {
        commits: snapshot.metrics.commits,
        pullRequests: snapshot.metrics.pullRequests,
        issues: snapshot.metrics.issues,
        reviews: snapshot.metrics.reviews,
      },
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
