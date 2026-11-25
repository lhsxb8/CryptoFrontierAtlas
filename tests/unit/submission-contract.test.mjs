import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {build} from 'esbuild';

async function reporting(repository) {
  const bundle = await build({
    entryPoints:[fileURLToPath(new URL('../../src/app/reporting.ts', import.meta.url))],
    bundle:true, write:false, platform:'node', format:'esm',
    plugins:[{name:'synthetic-project', setup(builder) {
      builder.onLoad({filter:/project\.config\.json$/}, () => ({loader:'json', contents:JSON.stringify({name:'CryptoFrontierAtlas', repository})}));
    }}],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const configured = await reporting('https://github.com/synthetic-owner/synthetic-atlas');
const pending = await reporting(null);
const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const fields = ['collection', 'purpose', 'source', 'claims', 'scope', 'costs', 'success', 'evidence', 'related-work', 'disclosure'];

test('all three configured reporting routes retain only their public template', () => {
  assert.equal(configured.submissionRoutes.length, 3);
  for (const route of configured.submissionRoutes) {
    const url = new URL(configured.submissionUrl(route));
    assert.equal(url.origin + url.pathname, configured.REPOSITORY_URL + '/issues/new');
    assert.deepEqual([...url.searchParams], [['template', route + '.yml']]);
    assert.equal(url.hash, '');
  }
  assert.equal(configured.SUBMISSION_GUIDE_URL, configured.REPOSITORY_URL + '/blob/main/docs/result-submissions.md');
});

test('an unconfigured project exposes a local guide and no invented repository', () => {
  assert.equal(pending.REPOSITORY_URL, null);
  assert.equal(pending.SUBMISSION_GUIDE_URL, './docs/result-submissions.md');
  for (const route of pending.submissionRoutes) assert.equal(pending.submissionUrl(route), null);
});

test('intake forms require the common scientific evidence fields', () => {
  for (const route of configured.submissionRoutes) {
    const form = read('.github/ISSUE_TEMPLATE/' + route + '.yml');
    const blocks = form.split(/(?=^  - type: )/m);
    const entries = blocks.flatMap(block => {
      const id = block.match(/^    id: ([a-z-]+)$/m)?.[1];
      return id ? [{id, block}] : [];
    });
    assert.equal(new Set(entries.map(item => item.id)).size, entries.length);
    for (const id of fields) {
      const field = entries.find(item => item.id === id);
      assert.ok(field, `${route}: ${id}`);
      assert.match(field.block, /required: true/);
    }
    assert.match(form, /docs\/result-submissions\.md/);
    assert.match(form, route === 'lean-formalization' ? /full commit hash/ : /full text|full-text/i);
    assert.doesNotMatch(form, /(?:\.agents|\.local|\.cache)\//);
  }
  const lean = read('.github/ISSUE_TEMPLATE/lean-formalization.yml');
  for (const id of ['replay', 'trust']) assert.match(lean, new RegExp(`id: ${id}\\n[\\s\\S]*?required: true`));
  assert.match(lean, /#print axioms/);
  assert.match(lean, /native_decide/);
  assert.match(read('docs/result-submissions.md'), /Publication and verification are separate/);
  assert.match(read('.github/ISSUE_TEMPLATE/config.yml'), /blank_issues_enabled: true/);
});
