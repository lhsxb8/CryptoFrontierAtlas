import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {catalogFixture} from '../helpers/primitive-catalog-fixtures.mjs';
import {resultFixture} from '../helpers/result-model-fixtures.mjs';

const require = createRequire(import.meta.url);
const {validatePrimitiveCatalog, assertAnalysisCatalogCompatibility} = require('../../lib/node/primitive-catalog.cjs');
const {compressionVariantErrors, compressionTargetErrors} = require('../../lib/cryptanalysis/compression.cjs');
const {targetErrors} = require('../../lib/cryptanalysis/result-model.cjs');
const {comparability} = require('../../lib/cryptanalysis/compare.cjs');
const compiled = await build({entryPoints:[fileURLToPath(new URL('../../src/app/atlas/model.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm'});
const ui = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

function fixture(mode = 'dm') {
  const catalog = catalogFixture();
  catalog.categories.push({id:'hash_function',domain:'symmetric',en:'Hash',zh:'哈希'});
  const name = `Fixture ${mode.toUpperCase()}`, family = `fixture-${mode}`, id = `${family}-128`;
  catalog.primitives.push({id:family,name,category:'hash_function',aliases:[],description:'Synthetic compression definition.',specification_ids:['fixture-spec'],uses:['fixture-block']});
  const parameters = {type:'hash_function',construction:'block_cipher_compression',mode,cipher_instance_id:'fixture-block-128',chaining_bits:128,message_bits:128,output_bits:128,cipher_rounds:10};
  catalog.instances.push({id,family_id:family,name,parameters,specification_ids:['fixture-spec'],locator:'Synthetic construction definition.'});
  const record = resultFixture(); record.target.variant_ids = [id]; record.experiment.construction.name = name;
  const block = {id:'fixture-block-128',family:'fixture-block',key_bits:128,block_bits:128,full_rounds:10,specification_source:'fixture-spec'};
  const variant = {id,family,name,full_rounds:10,specification_source:'fixture-spec',compression:{mode,cipher_variant_id:block.id,name,definition:record.experiment.construction.definition,output_bits:128}};
  const ciphers = [{id:block.family,primitive_type:'block_cipher'},{id:family,primitive_type:'hash_function'}];
  return {catalog, parameters, record, block, variant, ciphers, variants:[block,variant]};
}

test('compression definitions bind dimensions, mode, dependency and round basis explicitly', () => {
  for (const mode of ['dm','mmo','mp']) {
    const f = fixture(mode);
    validatePrimitiveCatalog(f.catalog);
    assertAnalysisCatalogCompatibility(f.catalog,f.ciphers,f.variants);
    assert.deepEqual(compressionVariantErrors(f.variant,f.variants,f.ciphers),[]);
    assert.deepEqual(targetErrors(f.record,f.variant),[]);
    assert.match(ui.variantParameters(f.variant),/compression output.*underlying cipher rounds/);
    assert.doesNotMatch(ui.variantParameters(f.variant),/secret|bit key/);
  }
});

test('bad compression dimensions, ordinary hash substitutes and implicit key mappings fail closed', () => {
  for (const mutate of [
    f=>{f.parameters.message_bits=192;}, f=>{f.parameters.chaining_bits=256;},
    f=>{f.parameters.output_bits=256;}, f=>{f.parameters.cipher_rounds=11;},
    f=>{f.parameters.key_bits=128;}, f=>{f.parameters.block_bits=128;},
    f=>{f.parameters.mode='unregistered';}, f=>{f.parameters.cipher_instance_id='fixture-xof-128';},
    f=>{f.catalog.primitives.at(-1).uses=[];}, f=>{f.parameters.construction='compression';},
  ]) {const f=fixture();mutate(f);assert.throws(()=>validatePrimitiveCatalog(f.catalog));}
  const f=fixture('mmo');f.catalog.instances[0].parameters.key_bits=192;
  f.catalog.instances.find(i=>i.family_id==='fixture-mac').parameters.key_bits=192;
  assert.throws(()=>validatePrimitiveCatalog(f.catalog),/unequal key\/block widths/);
  for (const mutate of [f=>{delete f.variant.compression;},f=>{f.variant.compression.mode='mp';},
    f=>{f.variant.compression.cipher_variant_id='missing';},f=>{f.variant.compression.name='Other construction';},
    f=>{f.variant.full_rounds=11;},f=>{f.variant.key_bits=128;},f=>{f.catalog.instances.pop();}]) {
    const f=fixture();mutate(f);assert.throws(()=>assertAnalysisCatalogCompatibility(f.catalog,f.ciphers,f.variants));
  }
});

test('a compression experiment cannot silently target its underlying block cipher', () => {
  const f=fixture();
  assert(compressionTargetErrors(f.record,f.block).some(s=>s.includes('requires a compression-function target')));
  for(const mutate of [r=>{delete r.experiment;},r=>{r.experiment.construction.name='Another mode';},
    r=>{r.experiment.construction.output_bits=64;},r=>{r.experiment.construction.definition='A different function';}]) {
    const r=structuredClone(f.record);mutate(r);assert(targetErrors(r,f.variant).length);
  }
  const dependency=structuredClone(f.variant);dependency.compression.cipher_variant_id=dependency.id;
  assert(compressionVariantErrors(dependency,[f.block,dependency],f.ciphers).length);
  const other=structuredClone(f.record);other.target.variant_ids=['fixture-mmo-128'];
  assert.equal(comparability(f.record,other).comparable,false);
});

test('old result context is normalized only for its evidenced compression dependency', () => {
  const f=fixture(),params=new URLSearchParams({variant:f.block.id,family:f.block.family,q:'preserved',sort:'source-year-desc'});
  const result=ui.canonicalResultParams(f.record,params,f.variants);
  assert.equal(result.get('variant'),f.variant.id);assert.equal(result.get('family'),f.variant.family);
  assert.equal(result.get('q'),'preserved');assert.equal(params.get('variant'),f.block.id);
  assert.equal(ui.canonicalResultParams(f.record,new URLSearchParams({variant:'wrong-instance'}),f.variants).get('variant'),'wrong-instance');
  const plain=structuredClone(f.record);plain.target.variant_ids=[f.block.id];delete plain.experiment;
  assert.equal(ui.canonicalResultParams(plain,params,f.variants).get('variant'),f.block.id);
  const route={page:'result',id:f.record.id,params};
  assert.equal(ui.routeScopeParams(route,f.ciphers,f.variants,[f.record]).get('variant'),f.variant.id);
  const ambiguous={...f.variant,id:'fixture-second-compression'};
  const shared={...f.record,target:{...f.record.target,variant_ids:[f.variant.id,ambiguous.id]}};
  assert.equal(ui.canonicalResultParams(shared,params,[...f.variants,ambiguous]).get('variant'),f.block.id);
});
