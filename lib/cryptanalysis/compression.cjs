'use strict';

// A compression target has its own identity. Its dependency is not a secret key.
function compressionVariantErrors(variant, variants, ciphers) {
  if (!variant.compression) return [];
  const errors = [], c = variant.compression;
  const underlying = variants.find(v => v.id === c.cipher_variant_id);
  if (ciphers.find(f => f.id === variant.family)?.primitive_type !== 'hash_function') errors.push('compression target must belong to Hash');
  if (!underlying || underlying.compression || ciphers.find(f => f.id === underlying.family)?.primitive_type !== 'block_cipher') {
    errors.push('compression target requires a registered block-cipher dependency');
    return errors;
  }
  if (variant.key_bits !== undefined || variant.block_bits !== undefined) errors.push('compression inputs are not secret-key/block parameters');
  if (variant.full_rounds !== underlying.full_rounds) errors.push('compression rounds must count underlying cipher rounds');
  if (c.output_bits !== underlying.block_bits) errors.push('compression output must match the cipher block width');
  if (c.mode !== 'dm' && underlying.key_bits !== underlying.block_bits) errors.push('MMO/MP require equal key/block widths without a separate key mapping');
  return errors;
}

function compressionTargetErrors(result, variant) {
  if (!variant) return [];
  const c = variant.compression, e = result.experiment?.construction;
  if (!c) return e?.type === 'compression_function' ? ['compression experiment requires a compression-function target, not its underlying cipher'] : [];
  if (e?.type !== 'compression_function') return ['compression target requires its compression experiment'];
  const errors = [];
  if (e.name !== c.name) errors.push('compression construction does not match the target');
  if (e.output_bits !== c.output_bits) errors.push('compression experiment output width does not match the target');
  if (e.definition.replace(/\s+/g, '') !== c.definition.replace(/\s+/g, '')) errors.push('compression definition does not match the registered target');
  return errors;
}

module.exports = {compressionVariantErrors, compressionTargetErrors};
