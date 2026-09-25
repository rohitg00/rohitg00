export const TOP_REPOSITORIES_START = '<!-- PUBLIC_PROFILE_TOP_REPOSITORIES:START -->';
export const TOP_REPOSITORIES_END = '<!-- PUBLIC_PROFILE_TOP_REPOSITORIES:END -->';
export const RECENT_ACTIVITY_START = '<!-- PUBLIC_PROFILE_RECENT_ACTIVITY:START -->';
export const RECENT_ACTIVITY_END = '<!-- PUBLIC_PROFILE_RECENT_ACTIVITY:END -->';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fullNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('en').format(value) : 'N/A';
}

function date(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function shortText(value, limit) {
  const text = String(value ?? 'No description provided.');
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function repositoryCell(repository) {
  const language = repository.language ? `<code>${escapeHtml(repository.language)}</code> · ` : '';
  return `<td width="50%" valign="top">
<h3><a href="${escapeHtml(repository.url)}">${escapeHtml(repository.name)}</a></h3>
<p>${escapeHtml(shortText(repository.description, 150))}</p>
<sub>${language}<strong>★ ${escapeHtml(fullNumber(repository.stars))}</strong> · ${escapeHtml(
    fullNumber(repository.forks),
  )} forks · Updated ${escapeHtml(date(repository.updatedAt))}</sub>
</td>`;
}

export function renderTopRepositories(repositories) {
  const rows = [];
  for (let index = 0; index < repositories.length; index += 2) {
    const left = repositoryCell(repositories[index]);
    const right = repositories[index + 1] ? repositoryCell(repositories[index + 1]) : '<td width="50%"></td>';
    rows.push(`<tr>
${left}
${right}
</tr>`);
  }
  return `<table>
${rows.join('\n')}
</table>`;
}

export function renderRecentActivity(activity) {
  const rows = activity.slice(0, 5).map(
    (item) => `<tr>
<td><sub>${escapeHtml(date(item.occurredAt))}</sub></td>
<td><a href="${escapeHtml(item.url)}"><strong>${escapeHtml(item.repository)}</strong></a></td>
<td>${escapeHtml(item.label)}</td>
</tr>`,
  );
  return `<table>
<thead>
<tr><th>Date</th><th>Public repository</th><th>Activity</th></tr>
</thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>`;
}

function replaceSection(readme, start, end, content) {
  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`README markers are missing for ${start}`);
  }
  return `${readme.slice(0, startIndex + start.length)}\n${content}\n${readme.slice(endIndex)}`;
}

export function renderReadme(readme, snapshot) {
  const withRepositories = replaceSection(
    readme,
    TOP_REPOSITORIES_START,
    TOP_REPOSITORIES_END,
    renderTopRepositories(snapshot.topRepositories.slice(0, 5)),
  );
  return replaceSection(
    withRepositories,
    RECENT_ACTIVITY_START,
    RECENT_ACTIVITY_END,
    renderRecentActivity(snapshot.recentActivity),
  );
}
