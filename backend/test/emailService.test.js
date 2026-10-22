const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmailCredential } = require('../services/emailService');

test('normalizeEmailCredential removes whitespace from app passwords', () => {
  assert.equal(normalizeEmailCredential('hhyi wwpu ycou hxjo'), 'hhyiwwpuycouhxjo');
  assert.equal(normalizeEmailCredential('  abc123  '), 'abc123');
  assert.equal(normalizeEmailCredential(''), '');
});
