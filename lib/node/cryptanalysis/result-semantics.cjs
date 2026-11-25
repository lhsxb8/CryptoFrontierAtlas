'use strict';
const assert = require('node:assert/strict');
const {definition, semanticErrors, targetErrors} = require('../../cryptanalysis/result-model.cjs');

function assertKeyKnowledgeScope(result) {
  if (result.setting.key_model === 'known_key') {
    const goal = definition(result);
    assert(goal?.known_key && goal.kind === result.result_kind,
      result.id + ': known-key evidence supports a distinguisher or structural property, not unknown-key recovery');
  }
}

function assertResultSemantics(result) {
  const errors = semanticErrors(result);
  assert(errors.length === 0, result.id + ': ' + errors.join('; '));
}
function assertTarget(result, variant) {
  const errors = targetErrors(result, variant);
  assert(errors.length === 0, result.id + ': ' + errors.join('; '));
}
module.exports = {assertKeyKnowledgeScope, assertResultSemantics, assertTarget};
