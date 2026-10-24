import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deriveInputSighashType, INPUT_AUTHORIZATION_RULE_ID } from '../src/index.js';
const document = JSON.parse(readFileSync(new URL('../../../vectors/authorization-vectors.json', import.meta.url), 'utf8'));
test('every authorization vector exercises the actual witness interpreter', () => {
  assert.equal(document.ruleId, INPUT_AUTHORIZATION_RULE_ID);
  assert.equal(document.vectors.length, document.count);
  for (const vector of document.vectors) {
    const run = () => deriveInputSighashType(vector.witnessHex, vector.prevoutScriptPubKeyHex);
    if (vector.expectedError) assert.throws(run, { message: vector.expectedError }, vector.id);
    else assert.equal(run(), vector.expectedSighashType, vector.id);
  }
});
