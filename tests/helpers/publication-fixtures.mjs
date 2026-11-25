import {cpSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {resultFixture} from './result-model-fixtures.mjs';

const {payloadFields} = createRequire(import.meta.url)('../../lib/cryptanalysis/result-families.cjs');
export function writePublicationFixture(root) {
  const directory = join(root, 'data/cryptanalysis');
  const write = (file, value) => {
    const target = join(directory, file); mkdirSync(dirname(target), {recursive:true});
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  };
  cpSync(fileURLToPath(new URL('../../schemas/cryptanalysis', import.meta.url)), join(root, 'schemas/cryptanalysis'), {recursive:true});
  mkdirSync(join(root, 'data/questions'), {recursive:true});
  writeFileSync(join(root, 'data/questions/manifest.json'), JSON.stringify({records:[]}));
  const source = {id:'synthetic-model-source', title:'Synthetic publication fixture', authors:['Test Author'], year:2026,
    citation_label:'Aut26', publication:{venue:'Synthetic tests', year:2026, kind:'preprint', url:'https://example.invalid/papers/synthetic'},
    inspected_version:'Synthetic version, not a literature claim', url:'https://example.invalid/reports/synthetic.pdf',
    accessed_on:'2026-10-09', content_sha256:'a'.repeat(64), hash_note:'Synthetic test hash, not a real paper.',
    locators:['Synthetic page 1; reports/synthetic-local.md']};
  const record = resultFixture({id:'synthetic-detailed-point', goal:'compression_collision', kind:'collision_construction'});
  record.evidence[0].locator = 'Synthetic page 2; reports/synthetic-local.md';
  record.assessment.reproduction = 'collision_witness_only';
  const compact = resultFixture({id:'synthetic-compact-point', goal:'compression_collision', kind:'collision_construction', q:4});
  compact.resources.time.reported = '2^9'; compact.resources.time.log2 = 9;
  const review = {scope:'targeted_primary_text', decision:'keep_candidate', reviewed_on:'2026-10-09',
    next_action:'Read reports/synthetic-local.md', issue_ids:['synthetic-source-issue']};
  const entry = (point, recordId) => ({id:point.id, source_id:source.id, source_sha256:source.content_sha256,
    method:point.display.method, record_id:recordId, review,
    comparison:{relation:'incomparable', record_ids:[], reasons:['Synthetic comparison only.'], baseline_hash:'b'.repeat(64)},
    ...(recordId === null ? Object.fromEntries(payloadFields.filter(k=>k in point).map(k=>[k,point[k]])) : {})});
  write('sources.json', [source]);
  write('ciphers.json', [{id:'aes', name:'AES', primitive_type:'block_cipher', aliases:[], description:'Synthetic software test catalog, not a research dataset.'}]);
  write('variants.json', [{id:'aes-128', family:'aes', key_bits:128, block_bits:128, full_rounds:10, specification_source:source.id}]);
  write('results/'+record.id+'.json', record);
  write('entries/aes.jsonl', [entry(record, record.id), entry(compact, null)].map(JSON.stringify).join('\n')+'\n');
  write('result-families/aes.json', {schema_version:1, cipher_family_id:'aes', reviewed_on:'2026-10-09',
    families:[{id:'synthetic-parameterized-family', title:'Synthetic tuning family', construction:'Synthetic construction only.',
      representation:'formula', parameters:[{name:'q', meaning:'Synthetic multiplicity', domain:'q in {2,4}'}],
      points:[{result_id:record.id, values:{q:2}}, {result_id:compact.id, values:{q:4}}],
      evidence:[{source_id:source.id, locator:'Synthetic page 2; reports/synthetic-local.md'}],
      model:{resources:{time:{expression:'q * 2^7', unit:'synthetic-operations'}}, constraints:['q in {2,4}'],
        success:'Synthetic probability one', accounting:'Synthetic fixture accounting'}}], standalone_result_ids:[], excluded_results:[]});
  write('manifest.json', {schema_version:'0.11.0', dataset_version:'0.11.0', reviewed_on:'2026-10-09', local_only:true,
    record_count:1, source_count:1, records:[record.id], scope:'Synthetic snapshot fixture', verification_scope:'Not a scientific claim.'});
  write('witnesses.json', {schema_version:1, scope:'Synthetic witness contract', known_answer_source_id:source.id,
    scope_note:'No cryptographic witness verification is claimed by this fixture.', source:{pdf_sha256:source.content_sha256},
    round_convention:{id:record.target.round_convention}, witnesses:[{id:'synthetic-witness', result_id:record.id,
      rounds:record.target.rounds, key_bits:128, plaintext_control:record.setting.plaintext_model}]});
  write('coverage.json', {reviewed_on:'2026-10-09', family_ids:['aes'], coverage_kind:'synthetic', exhaustive:false,
    latest_or_best_known_claim:false, selection:'Synthetic test selection', included_counts:{synthetic:1},
    not_yet_covered:['Synthetic coverage gap'], queries_used:['Private synthetic collection query'],
    review_process:{extraction:'Private synthetic extraction task', independence_limit:'Synthetic fixture only'},
    issues:[{id:'synthetic-source-issue', status:'needs_review', affected_records:[record.id], affected_entries:[compact.id],
      action:'Qualification recorded in synthetic-private-batch.', evidence:['Synthetic page 2'], audit_report:'reports/synthetic-local.md'}],
    pending_sources:[{id:'synthetic-pending-source', status:'pending', reason:'Synthetic scope gap', url:'https://example.invalid/pending',
      tasks:[{next_action:'Private task'}], audit_report:'reports/synthetic-local.md'}],
    ingestion_batches:[{id:'synthetic-private-batch', reviewed_on:'2026-10-09', new_record_count:1, new_records:[record.id],
      indexed_existing_records:[], added_source_ids:[source.id], provenance_receipt:'provenance/reviews/synthetic.json'}]});
  write('provenance/reviews/synthetic.json', {schema_version:1, batch_id:'synthetic-private-batch', reviewed_on:'2026-10-09',
    source_versions:[{source_id:source.id, sha256:source.content_sha256, locators:['Synthetic page 2']}],
    decisions:[{source_ids:[source.id], result_ids:[record.id], decision:'needs_details', reason:'Synthetic unresolved scope.'}]});
  return {write, directory, source, record};
}
