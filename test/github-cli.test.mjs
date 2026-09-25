import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { githubApi } from '../scripts/lib/github-cli.mjs';

test('GitHub CLI sends GraphQL variables through stdin and keeps credentials out of argv', async () => {
  const body = { query: 'query($after: String) { viewer { login } }', variables: { after: null } };
  const result = await githubApi('graphql', 'test-secret', body, (binary, args, options, callback) => {
    assert.equal(binary, 'gh');
    assert.deepEqual(args.slice(-2), ['--input', '-']);
    assert.equal(args.includes('test-secret'), false);
    assert.equal(options.env.GH_TOKEN, 'test-secret');
    assert.equal(options.env.GH_DEBUG, '');
    const stdin = new EventEmitter();
    stdin.end = value => {
      assert.deepEqual(JSON.parse(value), body);
      callback(null, '{"data":{"viewer":{"login":"rohitg00"}}}');
    };
    return { stdin };
  });
  assert.equal(result.data.viewer.login, 'rohitg00');
});

test('failed CLI requests do not expose raw stderr or credentials', async () => {
  await assert.rejects(githubApi('/users/rohitg00', 'test-secret', null, (binary, args, options, callback) => {
    assert.equal(args[args.indexOf('--method') + 1], 'GET');
    const stdin = new EventEmitter();
    stdin.end = () => callback(Object.assign(new Error('test-secret'), { code: 1 }));
    return { stdin };
  }), error => /GitHub CLI request failed/.test(error.message) && !error.message.includes('test-secret'));
});
