export function parseLeaderboardRows(markdown) {
  return String(markdown ?? '').split('\n')
    .map(line => line.trim())
    .filter(line => /^\|\s*\d+/.test(line))
    .map(line => {
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      const rank = Number(cells[0].match(/^\d+/)?.[0]);
      const score = /^[\d,]+$/.test(cells.at(-1)) ? Number(cells.at(-1).replaceAll(',', '')) : NaN;
      return { rank, score };
    });
}

export function benchmarkPosition(rows, score) {
  if (!Number.isFinite(score) || score < 0 || !rows.length) return null;
  if (rows.some((row, index) => row.rank !== index + 1
    || !Number.isFinite(row.score) || row.score < 0)) return null;
  const profilesAhead = rows.filter(row => row.score > score).length;
  return profilesAhead === rows.length ? null : profilesAhead + 1;
}

function leaderboardTargets(countries) {
  return [
    { key: 'world', label: 'World', path: '/by/stars/1' },
    ...countries.map(country => ({
      ...country, path: `/country/${encodeURIComponent(country.path)}/stars/1`,
    })),
  ];
}

export async function fetchCreatorBenchmarks(score, countries, now = new Date(), fetcher = fetch) {
  const positions = await Promise.all(leaderboardTargets(countries).map(async target => {
    const source = `https://gitranks.com${target.path}`;
    const response = await fetcher(`https://r.jina.ai/http://gitranks.com${target.path}`, {
      headers: { Accept: 'text/plain', 'X-No-Cache': 'true', 'User-Agent': 'rohitg00-profile-rank' },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`GitRanks ${target.label} leaderboard returned ${response.status}.`);
    const rows = parseLeaderboardRows(await response.text());
    const position = benchmarkPosition(rows, score);
    if (position === null) throw new Error(`GitRanks ${target.label} score boundary could not be verified.`);
    return [target.key, { label: target.label, position, comparedProfiles: rows.length, source }];
  }));
  return {
    status: 'fresh',
    measuredValue: score,
    metric: 'stars on original public repositories',
    source: 'GitRanks Stars leaderboards via Jina Reader',
    method: 'one plus the number of leaderboard profiles with a higher creator score',
    interpretation: 'The same public creator score is benchmarked against each leaderboard; country values do not claim residency.',
    measuredAt: now.toISOString(),
    positions: Object.fromEntries(positions),
  };
}

export async function refreshCreatorBenchmarks(score, countries, previous, now = new Date(), fetcher = fetchCreatorBenchmarks) {
  try {
    return await fetcher(score, countries, now);
  } catch (error) {
    console.warn(`Creator benchmark refresh skipped: ${error.message}`);
    const targets = leaderboardTargets(countries);
    const verified = Number.isFinite(previous?.measuredValue) && previous.measuredValue >= 0
      && typeof previous.measuredAt === 'string' && Number.isFinite(Date.parse(previous.measuredAt))
      && targets.every(target => Number.isInteger(previous.positions?.[target.key]?.position)
        && previous.positions[target.key].position > 0);
    if (verified) return { ...previous, status: 'cached' };
    return {
      status: 'unavailable', measuredAt: null, measuredValue: null,
      positions: Object.fromEntries(targets.map(target => [target.key, { label: target.label, position: null }])),
    };
  }
}
