import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writePublicationFixture} from '../helpers/publication-fixtures.mjs';

const require = createRequire(import.meta.url);
const {makePublishedFiles, exportPublishedDataset, validatePublishedDataset, checkExport, fileInventory} = require('../../lib/node/cryptanalysis/published.cjs');
const {loadDataset} = require('../../lib/node/cryptanalysis/dataset.cjs');
const {publicText, assertPublicText} = require('../../lib/node/publication-safety.cjs');
const digest = text => createHash('sha256').update(text).digest('hex');
const json = x=>JSON.stringify(x,null,2)+'\n';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(),'atlas-published-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  return {root, output:join(root,'data/cryptanalysis-public'), ...writePublicationFixture(root)};
}
const fingerprint = dir=>digest(fileInventory(dir).sort().map(f=>f+'\0'+readFileSync(join(dir,f),'utf8')).join('\0'));
function editPublic(output, file, change) {
  const original=JSON.parse(readFileSync(join(output,file),'utf8')); change(original);
  writeFileSync(join(output,file),json(original));
  const publication=JSON.parse(readFileSync(join(output,'publication.json'),'utf8'));
  publication.files[file]=digest(readFileSync(join(output,file)));
  publication.data_sha256=digest(json(publication.files));
  writeFileSync(join(output,'publication.json'),json(publication));
}

test('export preserves the local corpus and scientific payload while projecting only public metadata',t=>{
  const f=fixture(t), before=fingerprint(f.directory);
  const summary=exportPublishedDataset(f.root);
  assert.deepEqual(summary,{records:1,entries:2,compact_only:1,parameterized_families:1,sources:1,ciphers:1,instances:1});
  assert.equal(fingerprint(f.directory),before);
  const {data}=validatePublishedDataset(f.root);
  assert.deepEqual(data.results[0].resources,f.record.resources);
  assert.equal(data.results[0].assessment.reproduction,'collision_witness_only');
  assert.equal(data.sources[0].url,f.source.url);
  assert.match(data.results[0].evidence[0].locator,/Synthetic page 2/);
  assert.match(data.results[0].evidence[0].locator,/not distributed/);
  assert.equal(data.entries[0].review.next_action,undefined);
  assert.deepEqual(data.coverage.ingestion_batches,[]);
  assert.equal(data.coverage.issues[0].audit_report,undefined);
  assert.equal(data.coverage.pending_sources[0].tasks,undefined);
  assert(!JSON.stringify(data).includes('synthetic-private-batch'));
  const first=[...makePublishedFiles(f.root).files];
  assert.deepEqual([...makePublishedFiles(f.root).files],first);
  checkExport(f.root);
  renameSync(f.directory,join(f.root,'private-research-away'));
  assert.equal(loadDataset(f.root,'public').compactResults.length,1);
  assert.throws(()=>loadDataset(f.root,'internal'),/not configured/);
});

test('failed export preserves the last valid snapshot, and raw edits require explicit re-export',t=>{
  const f=fixture(t); exportPublishedDataset(f.root);
  const before=fingerprint(f.output);
  const corrected=structuredClone(f.record); corrected.title='Corrected synthetic title';
  f.write('results/'+corrected.id+'.json',corrected);
  assert.throws(()=>checkExport(f.root),/stale/);
  assert.equal(fingerprint(f.output),before);
  corrected.evidence[0].source_id='synthetic-missing-source'; f.write('results/'+corrected.id+'.json',corrected);
  assert.throws(()=>exportPublishedDataset(f.root),/missing source/);
  assert.equal(fingerprint(f.output),before);
});

test('compression targets survive independent public validation and reject wrong-target records',t=>{
  const f=fixture(t),read=file=>JSON.parse(readFileSync(join(f.directory,file),'utf8'));
  const variant={id:'synthetic-dm-128',family:'synthetic-dm',name:'Synthetic DM',full_rounds:10,specification_source:f.source.id,
    compression:{mode:'dm',cipher_variant_id:'aes-128',name:'Synthetic DM',definition:'F(h,m)=E_m(h) xor h',output_bits:128}};
  f.write('ciphers.json',[...read('ciphers.json'),{id:variant.family,name:variant.name,primitive_type:'hash_function',aliases:[],description:'Synthetic compression target.'}]);
  f.write('variants.json',[...read('variants.json'),variant]);
  const convert=r=>{r.goal='compression_collision';r.result_kind='collision_construction';r.target.variant_ids=[variant.id];r.experiment.construction={type:'compression_function',name:variant.compression.name,definition:variant.compression.definition,output_bits:128};return r;};
  const compressionRecord=convert(structuredClone(f.record));
  compressionRecord.id='synthetic-compression-point';compressionRecord.assessment.reproduction='not_attempted';
  f.write('results/'+compressionRecord.id+'.json',compressionRecord);
  const manifest=read('manifest.json');manifest.records.push(compressionRecord.id);manifest.record_count++;
  f.write('manifest.json',manifest);
  const entries=readFileSync(join(f.directory,'entries/aes.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  for(const e of entries) {
    if(e.record_id===null)convert(e);
    else {e.id=compressionRecord.id;e.record_id=compressionRecord.id;}
  }
  renameSync(join(f.directory,'entries/aes.jsonl'),join(f.directory,'entries/synthetic-dm.jsonl'));
  f.write('entries/synthetic-dm.jsonl',entries.map(JSON.stringify).join('\n')+'\n');
  const catalog=read('result-families/aes.json');catalog.cipher_family_id=variant.family;
  catalog.families[0].points[0].result_id=compressionRecord.id;
  f.write('result-families/synthetic-dm.json',catalog);
  f.write('result-families/aes.json',{schema_version:1,cipher_family_id:'aes',reviewed_on:'2026-10-09',families:[],standalone_result_ids:[f.record.id],excluded_results:[]});
  exportPublishedDataset(f.root);
  renameSync(f.directory,join(f.root,'private-research-away'));
  const {data}=validatePublishedDataset(f.root);
  assert.deepEqual(data.variants.find(v=>v.id===variant.id).compression,variant.compression);
  editPublic(f.output,'results/'+compressionRecord.id+'.json',r=>{r.target.variant_ids=['aes-128'];});
  assert.throws(()=>validatePublishedDataset(f.root),/compression-function target/);
});

test('source fingerprint changes, unknown fields and scientific tampering fail independently',async t=>{
  for(const [name, mutate, message]of [
    ['unknown coverage metadata',f=>editPublic(f.output,'coverage.json',x=>x.private_task='Synthetic task'),/unapproved field/],
    ['unknown witness metadata',f=>editPublic(f.output,'witnesses.json',x=>x.witnesses[0].private_task='Synthetic task'),/unapproved field/],
    ['nested coverage metadata',f=>editPublic(f.output,'coverage.json',x=>x.issues[0].bounded_checks={private_task:'Synthetic task'}),/unapproved field/],
    ['nested scalar metadata',f=>editPublic(f.output,'witnesses.json',x=>x.source.title={private_task:'Synthetic task'}),/unexpected nested field/],
    ['local evidence path',f=>editPublic(f.output,'results/'+f.record.id+'.json',x=>x.evidence[0].locator='reports/synthetic-hidden.md'),/local artifact/],
    ['changed costs',f=>editPublic(f.output,'results/'+f.record.id+'.json',x=>{x.resources.time.log2=10;x.resources.time.reported='2^10';}),/scientific payload mismatch/],
    ['orphan source',f=>editPublic(f.output,'results/'+f.record.id+'.json',x=>x.evidence[0].source_id='synthetic-orphan'),/missing source/],
    ['extra file',f=>writeFileSync(join(f.output,'unexpected.json'),'{}'),/inventory mismatch/],
  ])await t.test(name,st=>{const f=fixture(st);exportPublishedDataset(f.root);mutate(f);assert.throws(()=>validatePublishedDataset(f.root),message);});
});

test('publication policy failures do not disclose restricted values or replace a valid export',t=>{
  const f=fixture(t);exportPublishedDataset(f.root);const before=fingerprint(f.output);
  mkdirSync(join(f.root,'.local'),{recursive:true});
  const restricted='Synthetic publication fixture';
  writeFileSync(join(f.root,'.local/publication-policy.json'),json({patterns:[restricted]}));
  assert.throws(()=>exportPublishedDataset(f.root),error=>/restricted content/.test(error.message)&&!error.message.includes(restricted));
  assert.equal(fingerprint(f.output),before);
});

test('snapshots reject redirected files and invalid file paths even when the receipt is edited',t=>{
  const f=fixture(t);exportPublishedDataset(f.root);
  symlinkSync(join(f.output,'manifest.json'),join(f.output,'redirect.json'));
  assert.throws(()=>validatePublishedDataset(f.root),/symlink/);
});

test('exports reject symlink inputs without replacing the previous snapshot',t=>{
  const f=fixture(t);exportPublishedDataset(f.root);const before=fingerprint(f.output);
  const original=join(f.directory,'witnesses.json'), moved=join(f.root,'synthetic-witnesses.json');
  renameSync(original,moved);symlinkSync(moved,original);
  assert.throws(()=>exportPublishedDataset(f.root),/redirected/);
  assert.equal(fingerprint(f.output),before);
});

test('public text projection keeps academic URLs and claim qualifications, never evaluates content',()=>{
  const value='Conditional claim; https://example.invalid/reports/paper.pdf; reports/local.md';
  const result=publicText(value);
  assert.match(result,/Conditional claim/);assert.match(result,/https:\/\/example.invalid\/reports\/paper.pdf/);
  assert.match(result,/not distributed/);assertPublicText(result,'synthetic');
  assert.throws(()=>assertPublicText('file:///tmp/synthetic','synthetic'),/local artifact/);
  const privateKeyHeader=['-----BEGIN OPENSSH', 'PRIVATE KEY-----'].join(' ');
  assert.throws(()=>assertPublicText(privateKeyHeader,'synthetic'),/credential-like/);
});
