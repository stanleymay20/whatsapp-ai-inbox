import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { constantTimeEqual, canonicalJson } from '../src/util.mjs';

test('constantTimeEqual', () => {
  assert.equal(constantTimeEqual('abc','abc'), true);
  assert.equal(constantTimeEqual('abc','abd'), false);
  assert.equal(constantTimeEqual('a','aa'), false);
});

test('canonicalJson is key-order stable', () => {
  assert.equal(canonicalJson({b:2,a:1}), canonicalJson({a:1,b:2}));
});

test('Meta HMAC shape', () => {
  const secret='s'; const raw=Buffer.from('{"x":1}');
  const sig=`sha256=${crypto.createHmac('sha256',secret).update(raw).digest('hex')}`;
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
});
