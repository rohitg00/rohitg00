import { BLUE, INK, PAPER, date, display, escapeXml, number, rule, text } from './svg.mjs';

function languageLegend(languages = []) {
  const visible = languages.slice(0, 3);
  const remainder = Math.max(0, 100 - visible.reduce((total, item) => total + item.percentage, 0));
  if (languages.length > 3 && remainder >= .1) visible.push({ name: 'Other', color: '#999999', percentage: Math.round(remainder * 10) / 10 });
  return visible;
}

function languageBar(languages, x, y, width) {
  let offset = 0;
  return languages.map(language => {
    const segment = Math.max(0, Math.min(width - offset, width * language.percentage / 100));
    const shape = `<rect x="${x + offset}" y="${y}" width="${segment}" height="9" fill="${escapeXml(language.color)}" />`;
    offset += segment;
    return shape;
  }).join('');
}

function projectRow(repository, x, y, width, compact) {
  const languages = languageLegend(repository.languages);
  const fontSize = compact ? 18 : 14;
  const legend = languages.map((language, index) => {
    const lx = x + (index % 2) * (width / 2);
    const ly = y + 112 + Math.floor(index / 2) * 26;
    return `<circle cx="${lx + 5}" cy="${ly - 5}" r="5" fill="${escapeXml(language.color)}" />`
      + text(lx + 18, ly, `${language.name} ${language.percentage.toFixed(1)}%`, '', `font-size="${fontSize}"`);
  }).join('');
  return display(x, y + 29, repository.name, compact ? 39 : 33, INK, '', width)
    + text(x, y + 59, `${number(repository.stars)} STARS   /   ${number(repository.forks)} FORKS`, 'stats')
    + languageBar(languages, x, y + 80, width)
    + (languages.length ? legend : text(x, y + 112, 'No language breakdown reported', 'note'))
    + text(x, y + 165, `Pushed ${date(repository.updatedAt)}`, 'note')
    + `<line x1="${x}" x2="${x + width}" y1="${y + 184}" y2="${y + 184}" stroke="${INK}" opacity=".2" />`;
}

function contributionRow(contribution, x, y, width, compact) {
  const point = x + 7;
  const left = x + 30;
  const language = contribution.language?.name ?? 'Mixed';
  const changeWidth = (width - 30) / 2;
  const delta = Number.isFinite(contribution.additions) && Number.isFinite(contribution.deletions)
    ? text(left, y + 86, 'SUM OF MERGED PR DIFFS', 'note')
      + display(left, y + 117, `+${number(contribution.additions)}`, 30, '#167244', '', changeWidth - 18)
      + display(left + changeWidth, y + 117, `-${number(contribution.deletions)}`, 30, '#af3540', '', changeWidth - 18)
    : '';
  return `<line x1="${point}" y1="${y + 8}" x2="${point}" y2="${y + 178}" stroke="${BLUE}" opacity=".25" />`
    + `<circle cx="${point}" cy="${y + 20}" r="6" fill="${PAPER}" stroke="${BLUE}" stroke-width="2" />`
    + display(left, y + 29, contribution.nameWithOwner, compact ? 37 : 32, INK, '', width - 30)
    + text(left, y + 64, `${number(contribution.mergedPullRequests)} MERGED PR${contribution.mergedPullRequests === 1 ? '' : 's'} / ALL TIME`, 'stats blue')
    + delta
    + text(left, y + 143, `${language} · ${number(contribution.stars)} stars · ${number(contribution.forks)} forks`, 'note')
    + text(left, y + 171, `Latest merge ${date(contribution.lastMergedAt)}`, 'note');
}

export function renderPublicWorkSvg(snapshot, { compact = false } = {}) {
  const width = compact ? 600 : 1200;
  const inset = compact ? 28 : 40;
  const column = compact ? 544 : 520;
  const repositories = (snapshot.topRepositories ?? []).slice(0, 5);
  const contributions = (snapshot.recentContributions ?? []).slice(0, 5);
  const projectsY = compact ? 276 : 196;
  const contributionsHeading = compact ? projectsY + repositories.length * 200 + 62 : 148;
  const contributionsY = compact ? contributionsHeading + 58 : 196;
  const bottom = Math.max(projectsY + repositories.length * 200, contributionsY + Math.max(1, contributions.length) * 200) + 28;
  const height = bottom + 76;
  const techStack = (snapshot.techStack ?? []).map((name, index) => {
    const x = inset + (compact ? index % 3 * 188 : index * 228);
    const y = compact ? 58 + Math.floor(index / 3) * 61 : 58;
    const chipWidth = compact ? 168 : 208;
    return `<rect x="${x}" y="${y}" width="${chipWidth}" height="44" fill="${PAPER}" stroke="${BLUE}" stroke-width=".8" />`
      + display(x + 13, y + 31, name, compact ? 30 : 33, BLUE, '', chipWidth - 26);
  }).join('');
  const right = compact ? inset : 640;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="work-title work-description">
  <title id="work-title">Tech stack, top repositories, and recent contributions</title>
  <desc id="work-description">${escapeXml(`Rohit's tech stack: ${(snapshot.techStack ?? []).join(', ')}. Five top original repositories with language breakdowns. Recently contributed public repositories show Rohit's all-time merged pull request counts and summed PR diffs. Stars and forks describe each repository. Refreshed ${date(snapshot.generatedAt)}.`)}</desc>
  <defs>
    <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${INK}" opacity=".1" /></pattern>
    <style>
      text { font-family: "SFMono-Regular", "Liberation Mono", Consolas, monospace; fill: ${INK}; }
      .label { font-size: ${compact ? 17 : 14}px; letter-spacing: 1px; font-weight: 600; }
      .note { font-size: ${compact ? 16 : 13}px; }
      .stats { font-size: ${compact ? 19 : 16}px; }
      .blue { fill: ${BLUE}; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${PAPER}" />
  <rect width="${width}" height="${height}" fill="url(#dots)" />
  ${text(inset, 32, 'FIG_004 / TECH STACK', 'label blue')}
  ${techStack}
  ${rule(compact ? 184 : 122, width, inset)}
  ${text(inset, compact ? 228 : 148, 'FIG_005 / TOP 5 REPOSITORIES', 'label')}
  ${text(inset, compact ? 255 : 175, 'Original public projects · languages by code size', 'note')}
  ${repositories.map((repository, index) => projectRow(repository, inset, projectsY + index * 200, column, compact)).join('')}
  ${compact ? rule(contributionsHeading - 33, width, inset) : `<path d="M600 144V${bottom - 28}" stroke="${BLUE}" stroke-dasharray="3 5" opacity=".25" />`}
  ${text(right, contributionsHeading, 'FIG_006 / RECENT CONTRIBUTIONS', 'label')}
  ${text(right, contributionsHeading + 27, 'Merged PRs to other public repositories', 'note')}
  ${contributions.length ? contributions.map((contribution, index) => contributionRow(contribution, right, contributionsY + index * 200, column, compact)).join('') : text(right, contributionsY + 40, 'No public merged contributions found.', 'note')}
  ${rule(bottom, width, inset)}
  ${text(inset, bottom + 28, 'SOURCE / PUBLIC GITHUB DATA', 'note')}
  ${text(compact ? inset : width - inset, bottom + (compact ? 53 : 28), `REFRESHED ${date(snapshot.generatedAt)}`, 'note', compact ? '' : 'text-anchor="end"')}
  <rect y="${height - 4}" width="${width}" height="4" fill="${BLUE}" />
</svg>`;
}
