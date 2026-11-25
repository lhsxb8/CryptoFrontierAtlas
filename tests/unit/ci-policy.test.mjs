import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');

test('PR and main checks use pinned Actions and read-only default permissions', () => {
  assert.match(workflow,/^  pull_request:/m);
  assert.match(workflow,/^  push:\n    branches: \[main\]/m);
  assert.doesNotMatch(workflow,/pull_request_target|workflow_run/);
  assert.match(workflow,/^permissions:\n  contents: read\n/m);
  for (const [,action] of workflow.matchAll(/uses: ([^\s]+)/g)) assert.match(action,/^[\w-]+\/[\w-]+@[0-9a-f]{40}$/);
  assert.match(workflow,/persist-credentials: false/);
  for (const command of ['npm ci','npm audit','npm run check','npm run build','npm run check:release','npm run test:ui']) assert(workflow.includes(command),command);
});

test('the deployment job consumes the checked artifact with isolated permissions', () => {
  const [checks, deploy] = workflow.split(/^  deploy:\n/m);
  assert.ok(deploy);
  assert.match(deploy,/needs: check/);
  assert.match(deploy,/github\.event_name != 'pull_request'.*github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy,/ATLAS_PAGES_ENABLED == 'true'/);
  assert.match(deploy,/pages: write\n      id-token: write/);
  assert.match(deploy,/name: github-pages/);
  assert.doesNotMatch(deploy,/npm |checkout@|setup-node@|run:/);
  assert.doesNotMatch(checks,/pages: write|id-token: write/);
  assert(checks.indexOf('npm run test:ui') < checks.indexOf('actions/upload-pages-artifact@'));
  assert(checks.indexOf('npm run check:publication') < checks.indexOf('actions/upload-pages-artifact@'));
});

test('source-only release tags validate version and identity independently of Pages', () => {
  assert.match(workflow, /tags: \['v\*'\]/);
  assert.match(workflow, /ATLAS_RELEASE_TAG:.*github\.ref_name/);
  assert.match(workflow, /name: Check publication identity\n\s+if: startsWith\(github.ref, 'refs\/tags\/v'\) \|\|/);
});
