import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { constantTimeEqual, canonicalJson } from '../src/util.mjs';
import { oauthConsentHtml } from '../src/oauth-ui.mjs';
import { verifyJwtSignature } from '../src/auth.mjs';
import { classifyMessageFallback } from '../src/openai.mjs';

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

test('OAuth consent UI is nonce-protected and login-only', () => {
  const html = oauthConsentHtml('testNonce_123');
  assert.match(html, /<script nonce="testNonce_123">/);
  assert.match(html, /Public sign-up is disabled/);
  assert.doesNotMatch(html, /signUp\s*\(/);
  assert.match(html, /signInWithPassword/);
});

test('ES256 JWT signatures verify with Supabase-style JWKs', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve:'P-256' });
  const jwk = publicKey.export({ format:'jwk' });
  const signingInput = 'header.payload';
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), { key:privateKey, dsaEncoding:'ieee-p1363' });
  assert.equal(verifyJwtSignature({ alg:'ES256', jwk, signingInput, signature }), true);
  assert.equal(verifyJwtSignature({ alg:'ES256', jwk, signingInput:'header.tampered', signature }), false);
});

test('deterministic fallback elevates genuine opportunities', () => {
  const interview = classifyMessageFallback({ body:'We reviewed your application and would like to invite you for an interview. Please confirm tomorrow.' });
  assert.equal(interview.category, 'job');
  assert.equal(interview.opportunity, true);
  assert.equal(interview.action_required, true);
  assert.ok(interview.score >= 75);

  const routine = classifyMessageFallback({ body:'Hi, hope you are doing well.' });
  assert.equal(routine.priority, 'low');
  assert.equal(routine.opportunity, false);
});
