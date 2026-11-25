import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, symlinkSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../..',import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(),'atlas-question-contract-'));
  t.after(() => rmSync(directory,{recursive:true,force:true}));
  const write = (file,value) => { mkdirSync(dirname(join(directory,file)),{recursive:true}); writeFileSync(join(directory,file), JSON.stringify(value)); };
  const taxonomy = JSON.parse(readFileSync(join(root,'data/questions/taxonomy.json'),'utf8'));
  write('data/questions/taxonomy.json',taxonomy);
  mkdirSync(join(directory,'schemas/questions'),{recursive:true});
  cpSync(join(root,'schemas/questions/problem.schema.json'),join(directory,'schemas/questions/problem.schema.json'));
  const record = {
    schema_version:'0.2.0', id:'synthetic-question', group_id:'synthetic-group', title:'Synthetic question contract',
    summary:'Synthetic data for software validation, not a research claim.', formal_statement:{format:'markdown-latex',body:'A synthetic statement for a validation fixture.'},
    scope:{domain:'Synthetic fixture domain',assumptions:[],parameters:[],unresolved_remainder:'Synthetic fixture only.'},
    classification:{taxonomy_version:taxonomy.taxonomy_version,primary:taxonomy.domains[0].children[0].id,secondary:[],tags:[]},
    source:{kind:'explicit_conjecture',citations:[{role:'original_source',label:'Synthetic source',url:'https://example.invalid/fixture'}]},
    status:{public_mathematical_status:'open',public_verification_status:'none',peer_review_status:'not_submitted',disclosure:'problem_only',last_reviewed:'2026-11-24'},
    progress:[{date:'2026-11-24',kind:'source_statement',summary:'Synthetic fixture statement for validation.',citation_labels:['Synthetic source']}],
    artifacts:[],lean:{status:'none',available_in_repo:false},relations:{related:[],supersedes:[],superseded_by:[]},
  };
  write('data/questions/manifest.json',{record_count:1,records:[record.id],taxonomy_version:taxonomy.taxonomy_version});
  const save = () => write(`data/questions/problems/${record.id}.json`,record);
  const check = () => spawnSync(process.execPath,[join(root,'scripts/check-data.mjs')],{cwd:directory,encoding:'utf8'});
  save();
  return {directory,record,save,check};
}
function formalization(f) {
  const bytes = Buffer.from('theorem synthetic_fixture : True := True.intro\n');
  mkdirSync(join(f.directory,'data/formalizations'),{recursive:true});
  writeFileSync(join(f.directory,'data/formalizations/Synthetic.lean'),bytes);
  const tree = createHash('sha256').update('Synthetic.lean').update('\0').update(createHash('sha256').update(bytes).digest()).update('\n').digest('hex');
  const commit = '1'.repeat(40);
  f.record.lean = {status:'complete',available_in_repo:true,path:'data/formalizations/Synthetic.lean',commit,lean_version:'synthetic-toolchain',mathlib_version:'synthetic-lock',trusted_base:'Synthetic validation metadata.',replay_command:'Synthetic fixture, no replay is claimed.',source_tree_sha256:tree,source_tree_file_count:1};
  f.record.artifacts = [{role:'source_code',visibility:'repository_file',url:`https://github.com/synthetic-owner/fixture/blob/${commit}/data/formalizations/Synthetic.lean`,sha256:sha(bytes),license:'Apache-2.0'}];
  f.record.status.public_verification_status = 'repository_checked';
  f.save();
}

test('public question validation works without repository history or Lean', t => {
  const f = fixture(t), result = f.check();
  assert.equal(result.status,0,result.stderr);
});

test('public question validation rejects executable and credential-bearing evidence URLs', t => {
  const f = fixture(t);
  for (const url of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.invalid/']) {
    f.record.source.citations[0].url = url; f.save();
    assert.notEqual(f.check().status,0);
  }
});

test('vendored formalization fingerprints need source bytes, not historical Git objects', t => {
  const f = fixture(t); formalization(f);
  assert.equal(f.check().status,0);
  writeFileSync(join(f.directory,'data/formalizations/Synthetic.lean'),'-- changed\n');
  assert.match(f.check().stderr,/fingerprint mismatch/);
});

test('formalization paths and symlinks cannot redirect source validation', t => {
  const f = fixture(t); formalization(f);
  f.record.lean.path = 'data/formalizations/../private.lean'; f.save();
  assert.match(f.check().stderr,/safe data\/formalizations/);
  f.record.lean.path = 'data/formalizations/Synthetic.lean'; f.save();
  symlinkSync(join(f.directory,'README.md'),join(f.directory,'data/formalizations/redirect.lean'));
  assert.match(f.check().stderr,/contains a symlink/);
});
