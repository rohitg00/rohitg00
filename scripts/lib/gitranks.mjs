const CREATOR_DESCRIPTION = 'Counts stars on repositories owned by the profile.';

function renderedText(node) {
  if (typeof node === 'string') return node.startsWith('$') ? '' : node;
  if (typeof node === 'number') return String(node);
  if (!Array.isArray(node)) return '';
  if (node[0] === '$' && node.length === 4) return renderedText(node[3]?.children);
  return node.map(renderedText).join(' ');
}

export function parseGitRanksCreator(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[1,"(?:\\.|[^"\\])*"\])\)/g)]
    .map(match => JSON.parse(match[1])[1]).join('');
  const cards = chunks.split('\n').filter(line => line.includes(CREATOR_DESCRIPTION));
  for (const card of cards) {
    const tree = JSON.parse(card.slice(card.indexOf(':') + 1));
    const content = renderedText(tree).replace(/\s+/g, ' ');
    const position = content.match(/Position:\s*([\d,]+)\s*\/\s*([\d.]+[MK]?)/);
    const percentile = content.match(/Top\s*([\d.]+)\s*% of all ranked profiles/);
    const movement = content.match(/This month change:\s*([↑↓])\s*([\d,]+)/);
    const stars = content.match(/Total\s*star\s*s:\s*([\d,]+)/);
    if (!position || !percentile || !stars) continue;
    const result = {
      position: Number(position[1].replaceAll(',', '')),
      rankedProfiles: position[2],
      topPercent: Number(percentile[1]),
      monthlyChange: movement ? Number(movement[2].replaceAll(',', '')) * (movement[1] === '↓' ? -1 : 1) : null,
      stars: Number(stars[1].replaceAll(',', '')),
    };
    if (result.position > 0 && result.topPercent > 0 && result.topPercent <= 100 && result.stars >= 0) return result;
  }
  throw new Error('GitRanks creator ranking could not be verified.');
}

export async function fetchGitRanksCreator(username, now = new Date()) {
  const source = `https://gitranks.com/profile/${encodeURIComponent(username)}/ranks`;
  const response = await fetch(`https://r.jina.ai/${source}`, {
    headers: { 'X-No-Cache': 'true', 'X-Respond-With': 'html', 'User-Agent': 'rohitg00-profile-rank' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`GitRanks profile fetch failed with ${response.status}.`);
  return { ...parseGitRanksCreator(await response.text()), source, measuredAt: now.toISOString(), status: 'fresh' };
}

export async function refreshGitRanksCreator(username, previous, now = new Date(), fetcher = fetchGitRanksCreator) {
  try {
    return await fetcher(username, now);
  } catch (error) {
    console.warn(`GitRanks creator refresh skipped: ${error.message}`);
    return previous ? { ...previous, status: 'cached' } : { status: 'unavailable', measuredAt: null };
  }
}
