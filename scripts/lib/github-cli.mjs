import { execFile } from 'node:child_process';

export function githubApi(endpoint, token, body = null, run = execFile) {
  const args = ['api', endpoint, '--hostname', 'github.com', '--method', body ? 'POST' : 'GET',
    '--header', 'Accept: application/vnd.github+json',
    '--header', 'X-GitHub-Api-Version: 2022-11-28'];
  if (body) args.push('--input', '-');

  return new Promise((resolve, reject) => {
    const child = run('gh', args, {
      encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GH_TOKEN: token, GH_PROMPT_DISABLED: '1', GH_DEBUG: '' },
    }, (error, stdout) => {
      if (error) {
        reject(new Error(error.code === 'ENOENT'
          ? 'Install the GitHub CLI (gh) before refreshing the profile.'
          : `GitHub CLI request failed for ${endpoint.split('?')[0]} (exit ${error.code ?? 'timeout'}).`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`GitHub CLI returned invalid JSON for ${endpoint.split('?')[0]}.`));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(body ? JSON.stringify(body) : undefined);
  });
}
