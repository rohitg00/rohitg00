const READER_ROOT = 'https://r.jina.ai/http://gitranks.com';

export function parseLeaderboardRows(markdown) {
  return String(markdown ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\|\s*\d+/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const rank = Number.parseInt(cells[0].replace(/[^\d].*$/, ''), 10);
      const score = Number.parseInt(cells.at(-1).replaceAll(',', ''), 10);
      return Number.isFinite(rank) && Number.isFinite(score) ? { rank, score } : null;
    })
    .filter(Boolean);
}

export function benchmarkPosition(rows, score) {
  if (!rows.length) return null;
  if (rows.some((row, index) => row.rank !== index + 1)) return null;
  const profilesAhead = rows.filter((row) => row.score > score).length;
  if (profilesAhead === rows.length) return null;
  return profilesAhead + 1;
}

async function fetchLeaderboard(path) {
  const response = await fetch(`${READER_ROOT}${path}`, {
    headers: { Accept: 'text/plain', 'User-Agent': 'rohitg00-profile-rank', 'X-No-Cache': 'true' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`GitRanks leaderboard fetch failed with ${response.status} for ${path}`);
  }
  const rows = parseLeaderboardRows(await response.text());
  if (!rows.length) throw new Error(`No leaderboard rows found for ${path}`);
  return rows;
}

export async function fetchCreatorBenchmarks(score, countries, now = new Date()) {
  const targets = [
    { key: 'world', label: 'World', path: '/by/stars/1' },
    ...countries.map((country) => ({
      key: country.key,
      label: country.label,
      path: `/country/${encodeURIComponent(country.path)}/stars/1`,
    })),
  ];
  const results = await Promise.all(
    targets.map(async (target) => {
      const rows = await fetchLeaderboard(target.path);
      return [
        target.key,
        {
          label: target.label,
          position: benchmarkPosition(rows, score),
          comparedProfiles: rows.length,
        },
      ];
    }),
  );

  return {
    status: 'fresh',
    measuredValue: score,
    metric: 'stars on original public repositories',
    source: 'GitRanks Stars leaderboards via Jina Reader',
    method: 'one plus the number of leaderboard profiles with a higher creator score',
    interpretation: 'The same public creator score is benchmarked against each leaderboard; country values do not claim residency.',
    measuredAt: now.toISOString(),
    positions: Object.fromEntries(results),
  };
}

export async function refreshCreatorBenchmarks(score, countries, previous, now = new Date(), fetcher = fetchCreatorBenchmarks) {
  try {
    return await fetcher(score, countries, now);
  } catch (error) {
    console.warn(`Creator benchmark refresh skipped: ${error.message}`);
    return previous
      ? { ...previous, status: 'cached' }
      : { status: 'unavailable', measuredAt: null, measuredValue: null, positions: {} };
  }
}
