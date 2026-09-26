import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';

import { THEMES } from './theme.mjs';

const { ink: INK, blue: BLUE } = THEMES.light;
const fontBytes = readFileSync(new URL('../../assets/fonts/VT323-Regular.ttf', import.meta.url));
const displayFont = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));

export function escapeXml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function number(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('en').format(value) : 'N/A';
}

function rank(value) {
  return Number.isFinite(value) && value > 0 ? `#${number(value)}` : 'N/A';
}

export function date(value) {
  return value ? new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value)) : 'Unavailable';
}

export function text(x, y, value, className = '', extra = '') {
  return `<text x="${x}" y="${y}" class="${className}" ${extra}>${escapeXml(value)}</text>`;
}

export function display(x, y, value, size, color = BLUE, extra = '', maxWidth = Infinity) {
  size = Math.min(size, maxWidth / Math.max(1, displayFont.getAdvanceWidth(String(value), 1)));

  const fields = { M: ['x', 'y'], L: ['x', 'y'], Q: ['x1', 'y1', 'x', 'y'], C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'], Z: [] };
  const path = displayFont.getPath(String(value), x, y, size).commands.map(command =>
    command.type + fields[command.type].map(key => command[key].toFixed(2)).join(' '),
  ).join(' ');
  return `<g role="img" aria-label="${escapeXml(value)}"><title>${escapeXml(value)}</title><path d="${path}" fill="${color}" ${extra}/></g>`;
}

export function rule(y, width, inset, color = INK) {
  return `<line x1="${inset}" y1="${y}" x2="${width - inset}" y2="${y}" stroke="${color}" stroke-width=".8" opacity=".55" />`;
}

function change(history, snapshot, key, current, rankChange = false) {
  const previous = history.filter((entry) => entry.date < snapshot.generatedAt.slice(0, 10)).at(-1);
  if (!previous || !Number.isFinite(previous[key]) || !Number.isFinite(current)) return '';
  const delta = rankChange ? previous[key] - current : current - previous[key];
  const label = rankChange
    ? `${delta > 0 ? 'Up' : delta < 0 ? 'Down' : 'Unchanged'}${delta ? ` ${number(Math.abs(delta))} places` : ''}`
    : `${delta >= 0 ? '+' : '-'}${number(Math.abs(delta))}`;
  return `${label} since ${date(previous.date).slice(0, 6)}`;
}

function impactField(x, y, scale, { ink: INK, blue: BLUE }) {
  const dots = Array.from({ length: 550 }, (_, i) => {
    const angle = i * 2.399963;
    const radius = 48 + (i % 37) * 8.2;
    const cx = 362 + Math.cos(angle) * radius;
    const cy = (256 + Math.sin(angle) * radius * .28 - 155) * .5;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${.5 + (i % 4) * .25}" opacity="${.16 + (i % 7) * .08}" />`;
  }).join('');
  const ripples = Array.from({ length: 8 }, (_, ring) => {
    const points = Array.from({ length: 80 }, (_, i) => {
      const px = 12 + i * 9;
      const py = (216 + ring * 12 + 28 * Math.sin(i / 12 + ring * .10) + 6 * Math.sin(i / 5) - 155) * .5;
      return `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
    }).join(' ');
    return `<path d="${points}" fill="none" stroke="${BLUE}" stroke-width="${ring % 3 ? .8 : 1.4}" stroke-dasharray="${ring % 2 ? '1 5' : '16 4 2 5'}" opacity=".65" />`;
  }).join('');
  return `<g transform="translate(${x} ${y}) scale(${scale})" aria-hidden="true"><g fill="${BLUE}">${dots}</g>${ripples}<g transform="translate(553 50) scale(.7)" fill="${INK}"><circle cy="-6" r="4"/><path d="M-3 0L4 0L7 24L4 25L2 13L3 33L9 51L5 53L-1 37L-4 54L-8 53L-4 32L-4 13L-7 25L-10 24Z"/></g></g>`;
}

function radar(values, cx, cy, radius, compact, { ink: INK, blue: BLUE }) {
  const point = (index, scale = 1) => {
    const a = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return [cx + Math.cos(a) * radius * scale, cy + Math.sin(a) * radius * scale];
  };
  const points = (scores) => scores.map((value, i) => point(i, value)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const grid = [.25, .5, .75, 1].map(scale => `<polygon points="${points(Array(5).fill(scale))}" fill="none" stroke="${BLUE}" stroke-width=".6" opacity=".5" />`).join('');
  const axes = Array.from({ length: 5 }, (_, i) => {
    const [x, y] = point(i);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${INK}" stroke-width=".6" opacity=".55" />`;
  }).join('');
  const data = ['creation', 'shipping', 'collaboration', 'maintenance', 'community'].map(key => (values[key] ?? 0) / 100);
  const labels = [
    [cx, cy - radius - (compact ? 18 : 8), 'CREATION', 'middle'],
    [cx + radius + 16, cy - 19, 'SHIPPING', 'start'],
    [cx + radius * .70, cy + radius + 27, compact ? 'COLLAB.' : 'COLLABORATION', 'middle'],
    [cx - radius * .70, cy + radius + 27, compact ? 'MAINT.' : 'MAINTENANCE', 'middle'],
    [cx - radius - 16, cy - 19, 'COMMUNITY', 'end'],
  ];
  return `<g>${grid}${axes}<polygon points="${points(data)}" fill="url(#halftone)" stroke="${BLUE}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="${INK}"/>${labels.map(([x, y, label, align]) => text(x, y, label, 'radar-label', `text-anchor="${align}"`)).join('')}</g>`;
}

function organizationMarks(snapshot, compact, { blue: BLUE }) {
  const organizations = (snapshot.ecosystemOrganizations ?? snapshot.contributedOrganizations ?? []).slice(0, 7);
  const names = { microsoft: 'Microsoft', cncf: 'CNCF', docker: 'Docker', kubernetes: 'Kubernetes', modelcontextprotocol: 'MCP', 'iii-hq': 'iii', GoogleCloudPlatform: 'Google Cloud' };
  return organizations.map((organization, index) => {
    const x = compact ? 32 + index * 78 : 320 + index * 120;
    const y = compact ? 1407 : 872;
    const size = compact ? 44 : 36;
    const label = names[organization.login] ?? organization.displayName ?? organization.login;
    const title = organization.relationship === 'merged-public-prs'
      ? `${label}: ${number(organization.mergedPullRequests)} merged public pull requests`
      : `${label}: ${organization.relationship}`;
    const mark = organization.avatarDataUri
      ? `<image href="${escapeXml(organization.avatarDataUri)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`
      : text(x + size / 2, y + size * .66, label.slice(0, 2), 'label', `text-anchor="middle" style="fill:${THEMES.light.ink}"`);
    return `<g><title>${escapeXml(title)}</title><rect x="${x - 3}" y="${y - 3}" width="${size + 6}" height="${size + 6}" fill="${THEMES.light.paper}" stroke="${BLUE}" stroke-width=".8" />${mark}${compact ? '' : text(x + size / 2, y + 55, label.length > 18 ? `${label.slice(0, 17)}…` : label, 'org', 'text-anchor="middle"')}</g>`;
  }).join('');
}

function creatorRanking(snapshot, compact, { ink: INK, blue: BLUE }) {
  const ranking = snapshot.ranking.gitRanksCreator;
  const source = ranking?.status === 'cached' ? 'CACHED' : 'GITRANKS';
  const monthly = Number.isFinite(ranking?.monthlyChange) ? `${ranking.monthlyChange > 0 ? '+' : ''}${number(ranking.monthlyChange)}` : 'N/A';
  const position = rank(ranking?.position);
  const cohort = ranking?.rankedProfiles ? `of ${ranking.rankedProfiles} ranked profiles` : 'Rank unavailable';
  const percentile = Number.isFinite(ranking?.topPercent) ? `TOP ${ranking.topPercent}%` : 'Percentile unavailable';
  const sourceLabel = ranking?.measuredAt ? `${source} · ${date(ranking.measuredAt)}` : 'GITRANKS UNAVAILABLE';
  const heading = text(compact ? 28 : 40, compact ? 972 : 665, 'FIG_003 / GITRANKS CREATOR RANK', 'label')
    + text(compact ? 28 : 1160, compact ? 999 : 665, sourceLabel, 'note', compact ? '' : 'text-anchor="end"');
  if (compact) return heading
    + display(28, 1067, position, 80, BLUE, '', 145)
    + text(195, 1039, cohort, 'note') + text(195, 1068, percentile, 'body blue')
    + display(28, 1127, monthly, 49, BLUE, '', 95) + text(130, 1118, 'THIS MONTH', 'micro')
    + display(348, 1127, number(ranking?.stars), 45, INK, '', 220)
    + text(348, 1148, 'GITRANKS INDEXED STARS', 'micro');
  return heading
    + display(40, 716, position, 67, BLUE, '', 142)
    + text(204, 701, cohort, 'body') + text(204, 729, percentile, 'body blue')
    + display(590, 716, monthly, 61, BLUE, '', 180) + text(590, 738, 'THIS MONTH', 'micro')
    + display(870, 716, number(ranking?.stars), 61, INK, '', 290)
    + text(870, 738, 'GITRANKS INDEXED STARS', 'micro')
    + text(40, 756, 'GitRanks updates separately from the live GitHub totals above.', 'note');
}

function projects(snapshot, compact, { ink: INK }) {
  return (snapshot.topRepositories ?? []).slice(0, 3).map((repository, i) => {
    const x = compact ? 28 : 40 + i * 384;
    const y = compact ? 1220 + i * 49 : 816;
    const name = repository.name.length > 32 ? `${repository.name.slice(0, 31)}…` : repository.name;
    return display(x, y, name, 29, INK, '', compact ? 390 : 352)
      + text(compact ? 570 : x, compact ? y : y + 22, `${number(repository.stars)} stars`, 'project-stars', compact ? 'text-anchor="end"' : '');
  }).join('');
}

function countryBenchmarks(snapshot, compact, { ink: INK, blue: BLUE }) {
  const benchmark = snapshot.ranking.creatorBenchmarks;
  const inset = compact ? 28 : 40;
  const width = compact ? 600 : 1200;
  const positions = Object.values(benchmark?.positions ?? {}).slice(0, 5);
  const source = benchmark?.status === 'cached' ? 'CACHED' : 'GITRANKS';
  const measured = benchmark?.measuredAt ? `${source} · ${date(benchmark.measuredAt)}` : 'COMPARISONS UNAVAILABLE';
  const column = (width - inset * 2) / Math.max(1, positions.length);
  const ranks = positions.map((entry, index) => {
    const x = inset + index * column;
    return text(x, compact ? 123 : 91, entry.label.toUpperCase(), 'label')
      + display(x, compact ? 184 : 151, rank(entry.position), compact ? 64 : 80, BLUE, '', column - 14);
  }).join('');
  return `<g transform="translate(0 ${compact ? 1157 : 769})">`
    + text(inset, 32, 'COUNTRY RANK COMPARISON', 'label blue')
    + text(compact ? inset : width - inset, compact ? 58 : 32, measured, 'note', compact ? '' : 'text-anchor="end"')
    + text(inset, compact ? 86 : 59, `${number(benchmark?.measuredValue)} OWNED STARS / SAME SCORE IN EACH REGION`, 'note')
    + ranks
    + text(inset, compact ? 218 : 184, 'Score comparisons, not residency-based ranks.', 'note')
    + rule(compact ? 240 : 208, width, inset, INK)
    + '</g>';
}

export function renderPublicBuilderSvg(snapshot, history = [], { compact = false, theme = 'light' } = {}) {
  const palette = THEMES[theme];
  const { ink: INK, blue: BLUE, paper: PAPER } = palette;
  const width = compact ? 600 : 1200;
  const benchmarkHeight = compact ? 240 : 208;
  const height = (compact ? 1584 : 1024) + benchmarkHeight;
  const inset = compact ? 28 : 40;
  const followerRank = snapshot.ranking.followerWorld.position;
  const starChange = change(history, snapshot, 'ownedStars', snapshot.metrics.ownedStars);
  const rankChange = change(history, snapshot, 'followerRank', followerRank, true);
  const updated = `${date(snapshot.generatedAt)} · ${snapshot.generatedAt.slice(11, 16)} UTC`;
  const header = text(inset, 32, 'FIG_000 / PUBLIC BUILDER PROFILE', 'label blue')
    + text(width - inset, 32, `@${snapshot.profile.login}`, 'label', 'text-anchor="end"')
    + rule(49, width, inset, INK)
    + display(inset - 1, compact ? 104 : 108, snapshot.profile.name.toUpperCase(), compact ? 71 : 82, BLUE, '', width - inset * 2)
    + text(inset, compact ? 138 : 139, 'Building AI agent infrastructure & developer tools.', 'tagline')
    + text(inset, compact ? 172 : 164, compact ? 'CNCF Ambassador · Docker Captain · Google Developer Expert' : 'CNCF AMBASSADOR · DOCKER CAPTAIN · GOOGLE DEVELOPER EXPERT (CLOUD & GENAI) · PLATFORM ENGINEERING AMBASSADOR', 'roles')
    + (compact ? text(inset, 196, 'Platform Engineering Ambassador', 'roles') : '');
  const hero = compact
    ? `${text(28, 239, 'FIG_001 / WORLD FOLLOWER RANK', 'label')}
       ${impactField(-4, 449, .79, palette)}
       ${display(16, 435, rank(followerRank), 304, BLUE, `stroke="${PAPER}" stroke-width="5" paint-order="stroke fill"`, 548)}
       ${text(28, 574, `${number(snapshot.profile.followers)} public followers`, 'hero-detail')}
       ${text(28, 602, rankChange, 'note blue')}`
    : `${text(40, 203, 'FIG_001 / WORLD FOLLOWER RANK', 'label')}
       ${impactField(20, 430, 1, palette)}
       ${display(28, 420, rank(followerRank), 350, BLUE, `stroke="${PAPER}" stroke-width="7" paint-order="stroke fill"`, 730)}
       ${text(40, 574, `${number(snapshot.profile.followers)} PUBLIC FOLLOWERS`, 'hero-detail')}
       ${text(40, 601, rankChange, 'note blue')}
       <path d="M787 188V596" stroke="${BLUE}" stroke-width=".7" stroke-dasharray="3 5" opacity=".5" />
       ${text(824, 203, 'FIG_002 / BUILDER PROFILE', 'label')}
       ${radar(snapshot.builderIndex.values, 987, 331, 86, false, palette)}
       ${display(821, 535, snapshot.builderIndex.score.toFixed(1), 77, BLUE, '', 140)}
       ${display(968, 532, '/100', 34, INK)}
       ${text(1044, 514, 'BUILDER INDEX', 'micro')}
       ${text(1044, 535, 'CUSTOM SCORE', 'micro')}
       ${text(1160, 596, 'PUBLIC DATA ONLY', 'micro', 'text-anchor="end"')}`;
  const mobileProfile = compact ? `${rule(544, width, inset, INK)}
       ${display(28, 611, number(snapshot.metrics.ownedStars), 74, BLUE, '', 270)}
       ${text(28, 639, 'ORIGINAL REPO STARS', 'body')}
       ${text(28, 665, starChange, 'note blue')}
       ${display(28, 732, number(snapshot.profile.originalRepositoryCount), 72, BLUE, '', 270)}
       ${text(28, 758, 'ORIGINAL REPOSITORIES', 'body')}
       ${text(351, 578, 'FIG_002 / BUILDER', 'micro')}
       ${radar(snapshot.builderIndex.values, 440, 671, 50, true, palette)}
       ${display(354, 814, snapshot.builderIndex.score.toFixed(1), 63, BLUE, '', 119)}
       ${text(485, 811, '/ 100', 'body')}
       ${text(353, 835, 'CUSTOM SCORE', 'micro')}` : '';
  const stats = compact
    ? [['COMMITS', snapshot.metrics.commits], ['PULL REQUESTS', snapshot.metrics.pullRequests], ['ISSUES', snapshot.metrics.issues], ['REVIEWS', snapshot.metrics.reviews]]
    : [['OWNED STARS', snapshot.metrics.ownedStars], ['COMMITS / 365D', snapshot.metrics.commits], ['PRS / 365D', snapshot.metrics.pullRequests], ['ISSUES / 365D', snapshot.metrics.issues], ['REVIEWS / 365D', snapshot.metrics.reviews], ['TOP PROJECT WORLD', rank(snapshot.ranking.topProjectWorld.position)]];
  const metrics = stats.map(([label, value], i) => {
    const x = inset + i * (compact ? 144 : 190);
    return display(x, compact ? 899 : 582, typeof value === 'number' ? number(value) : value, compact ? 48 : 53, i === 0 || i === 5 ? BLUE : INK, '', compact ? 126 : 174)
      + text(x, compact ? 922 : 606, label, 'metric-label');
  }).join('') + (compact ? text(28, 865, 'PUBLIC ACTIVITY / LAST 365 DAYS', 'micro') : text(40, 626, starChange, 'small blue'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(snapshot.profile.name)} public GitHub profile</title>
  <desc id="description">${escapeXml(`${number(snapshot.metrics.ownedStars)} original public repository stars, ${number(snapshot.profile.followers)} followers, world follower rank ${rank(followerRank)}. Updated ${updated}. Public data only. GitRanks creator ranks use its own indexed star total.`)}</desc>
  <defs>
    <pattern id="paper" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${INK}" opacity=".10" /></pattern>
    <pattern id="grain" width="37" height="29" patternUnits="userSpaceOnUse"><circle cx="7" cy="11" r=".4" fill="${INK}" opacity=".1"/><circle cx="24" cy="21" r=".35" fill="${INK}" opacity=".1"/></pattern>
    <pattern id="halftone" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.4" cy="1.4" r="1.05" fill="${BLUE}"/><circle cx="3.9" cy="3.9" r=".55" fill="${BLUE}"/></pattern>
    <style>
      text { font-family: "SFMono-Regular", "Liberation Mono", Consolas, monospace; fill: ${INK}; }
      .label { font-size: ${compact ? 15 : 12}px; letter-spacing: ${compact ? '.7' : '1.25'}px; font-weight: 600; }
      .tagline { font-family: Georgia, "Times New Roman", serif; font-size: ${compact ? 22 : 23}px; }
      .roles { font-size: ${compact ? 12.5 : 11.5}px; }
      .note { font-size: ${compact ? 15 : 12}px; }
      .body { font-size: ${compact ? 15 : 13}px; letter-spacing: .5px; }
      .hero-detail { font-family: Georgia, "Times New Roman", serif; font-size: ${compact ? 24 : 22}px; }
      .metric-label { font-size: ${compact ? 13 : 11}px; letter-spacing: .5px; }
      .micro { font-size: ${compact ? 13 : 10}px; letter-spacing: .4px; }
      .small { font-size: 11px; }
      .radar-label { font-size: ${compact ? 9.5 : 10}px; letter-spacing: .5px; }
      .project-stars { font-size: ${compact ? 17 : 13}px; fill: ${BLUE}; }
      .org { font-size: 10px; }
      .blue { fill: ${BLUE}; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${PAPER}" />
  <rect width="${width}" height="${height}" fill="url(#paper)" />
  <rect width="${width}" height="${height}" fill="url(#grain)" />
  ${header}
  ${hero}
  <g transform="translate(0 80)">
${mobileProfile}
  ${rule(compact ? 846 : 538, width, inset, INK)}
  ${metrics}
  ${rule(compact ? 942 : 641, width, inset, INK)}
  ${creatorRanking(snapshot, compact, palette)}
  ${rule(compact ? 1157 : 769, width, inset, INK)}
  ${countryBenchmarks(snapshot, compact, palette)}
  <g transform="translate(0 ${benchmarkHeight})">
  ${text(inset, compact ? 1190 : 792, 'SELECTED OPEN SOURCE', 'label')}
  ${projects(snapshot, compact, palette)}
  ${rule(compact ? 1350 : 853, width, inset, INK)}
  ${text(inset, compact ? 1381 : 883, 'ECOSYSTEM REACH', 'label')}
  ${text(inset, compact ? 1477 : 907, 'PUBLIC CONTRIBUTIONS + ROLES', 'micro')}
  ${organizationMarks(snapshot, compact, palette)}
  ${rule(compact ? 1490 : 933, width, inset, INK)}
  </g>
  </g>
</svg>`;
}
