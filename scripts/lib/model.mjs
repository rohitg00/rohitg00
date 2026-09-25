import { createHash } from 'node:crypto';

export const BUILDER_INDEX_MODEL = {
  version: '1.0.0',
  components: {
    creation: { weight: 0.35, cap: 100_000 },
    shipping: { weight: 0.25, cap: 1_000 },
    collaboration: { weight: 0.2, pullRequestCap: 250, reviewCap: 500 },
    maintenance: { weight: 0.1, cap: 250 },
    community: { weight: 0.1, cap: 10_000 },
  },
};

export function logarithmicScore(value, cap) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(100, (Math.log1p(value) / Math.log1p(cap)) * 100);
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateBuilderIndex(snapshot) {
  const { components } = BUILDER_INDEX_MODEL;
  const creation = logarithmicScore(snapshot.metrics.ownedStars, components.creation.cap);
  const shipping = logarithmicScore(snapshot.metrics.commits, components.shipping.cap);
  const collaboration =
    logarithmicScore(snapshot.metrics.pullRequests, components.collaboration.pullRequestCap) * 0.65 +
    logarithmicScore(snapshot.metrics.reviews, components.collaboration.reviewCap) * 0.35;
  const maintenance = logarithmicScore(snapshot.metrics.issues, components.maintenance.cap);
  const community = logarithmicScore(snapshot.profile.followers, components.community.cap);

  const values = {
    creation: round(creation),
    shipping: round(shipping),
    collaboration: round(collaboration),
    maintenance: round(maintenance),
    community: round(community),
  };

  const score = Object.entries(values).reduce(
    (total, [name, value]) => total + value * components[name].weight,
    0,
  );

  return {
    score: round(score),
    scale: 100,
    values,
    model: BUILDER_INDEX_MODEL,
    classification: classifyBuilder(score),
    globalRank: null,
    globalRankStatus: 'A reproducible comparison corpus is required before this score can claim a world rank.',
  };
}

function classifyBuilder(score) {
  if (score >= 90) return 'Public ecosystem builder';
  if (score >= 75) return 'Open source builder';
  if (score >= 55) return 'Active maintainer';
  if (score >= 35) return 'Active contributor';
  return 'Emerging builder';
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

export function finalizeSnapshot(rawSnapshot, previousSnapshot, now = new Date()) {
  const candidate = {
    schemaVersion: 1,
    ...rawSnapshot,
    builderIndex: calculateBuilderIndex(rawSnapshot),
    privacy: {
      visibility: 'public-only',
      privateRepositoriesIncluded: false,
      restrictedContributionTotalsIncluded: false,
      titlesAndCommitMessagesIncluded: false,
      policy: 'Every contribution row must belong to a repository whose GitHub visibility is PUBLIC.',
    },
  };
  const fingerprintCandidate = structuredClone(candidate);
  delete fingerprintCandidate.ranking?.gitRanksCreator?.measuredAt;
  const contentFingerprint = fingerprint(fingerprintCandidate);
  const unchanged = previousSnapshot?.fingerprint === contentFingerprint;

  return {
    ...candidate,
    fingerprint: contentFingerprint,
    generatedAt: unchanged ? previousSnapshot.generatedAt : now.toISOString(),
  };
}
