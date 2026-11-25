import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const root = fileURLToPath(new URL('../..', import.meta.url));
const bundled = await build({
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
  stdin: {contents: "export {structureBinding} from './src/features/primitives/model'; export {default as Modal} from './src/components/Modal';", resolveDir: root, loader: 'ts'},
});
const compiled = {exports: {}};
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const {structureBinding, Modal} = compiled.exports;

function structures() {
  return {
    registry: {diagrams: [{family_id: 'fixture', instance_ids: ['fixture-128'], review: {status: 'source_checked'}, views: [{id: 'overview'}]}]},
    manifest: {assets: ['fixture', 'fixture-128'].map(target_id => ({target_id, family_id: 'fixture', view_id: 'overview'}))},
  };
}

test('parameter placement and figure rendering use the same exact reviewed binding', () => {
  const data = structures();
  assert.equal(structureBinding(data, 'fixture').asset.target_id, 'fixture');
  assert.equal(structureBinding(data, 'fixture', 'fixture-128').asset, data.manifest.assets[1]);
  assert.equal(structureBinding(data, 'fixture', 'fixture-research'), undefined);
  assert.equal(structureBinding(data, 'other', 'fixture-128'), undefined);
  assert.equal(structureBinding(data, 'fixture', 'fixture-128', 'detail'), undefined);
});

test('missing, wrong-family and unreviewed assets cannot suppress fallback parameters', () => {
  for (const modify of [
    data => {data.registry.diagrams[0].review.status = 'pending';},
    data => {data.manifest.assets = [];},
    data => {data.manifest.assets[1].family_id = 'other';},
  ]) {
    const data = structures(); modify(data);
    assert.equal(structureBinding(data, 'fixture', 'fixture-128'), undefined);
  }
});

test('description-free dialogs have a title and no empty paragraph or dangling description', () => {
  for (const description of [undefined, '']) {
    const html = renderToStaticMarkup(createElement(Modal, {title: 'Fixture dialog', description, closeLabel: 'Close', onClose() {}}, createElement('div', null, 'Body')));
    assert.match(html, /aria-labelledby=/);
    assert.match(html, /Fixture dialog/);
    assert.doesNotMatch(html, /aria-describedby|<p\b/);
  }
});

test('meaningful diagram descriptions remain explicitly associated with their dialog', () => {
  const html = renderToStaticMarkup(createElement(Modal, {title: 'Fixture figure', description: 'Synthetic operator legend', closeLabel: 'Close', onClose() {}}, 'Figure'));
  const id = html.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(id);
  assert.ok(html.includes(`<p id="${id}">Synthetic operator legend</p>`));
});
