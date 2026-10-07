import crypto from 'node:crypto';
import { config } from './config.mjs';
import { constantTimeEqual } from './util.mjs';

let discoveryCache = null;
let jwksCache = { at: 0, keys: [] };

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function discovery() {
  if (discoveryCache) return discoveryCache;
  if (!config.oauthIssuer) throw new Error('oauth_issuer_not_configured');
  const r = await fetch(`${config.oauthIssuer}/.well-known/openid-configuration`);
  if (!r.ok) throw new Error(`oauth_discovery_${r.status}`);
  discoveryCache = await r.json();
  return discoveryCache;
}

async function jwks() {
  if (Date.now() - jwksCache.at < 300_000 && jwksCache.keys.length) return jwksCache.keys;
  const d = config.oauthJwksUri ? null : await discovery();
  const uri = config.oauthJwksUri || d?.jwks_uri;
  if (!uri) throw new Error('oauth_jwks_uri_missing');
  const r = await fetch(uri);
  if (!r.ok) throw new Error(`jwks_${r.status}`);
  const payload = await r.json();
  jwksCache = { at: Date.now(), keys: payload.keys || [] };
  return jwksCache.keys;
}

function verifyAudience(aud) {
  if (!config.oauthAudience) return true;
  return Array.isArray(aud) ? aud.includes(config.oauthAudience) : aud === config.oauthAudience;
}

export async function verifyBearer(header) {
  if (config.allowInsecureNoAuth) return { sub: 'insecure-dev', scopes: config.oauthScopes };
  const m = /^Bearer\s+(.+)$/i.exec(header || '');
  if (!m) return null;
  const token = m[1];
  if (config.devBearerToken && constantTimeEqual(token, config.devBearerToken)) {
    return { sub: 'dev-token', scopes: config.oauthScopes };
  }
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const headerObj = JSON.parse(b64urlDecode(parts[0]));
  const payload = JSON.parse(b64urlDecode(parts[1]));
  if (headerObj.alg !== 'RS256' || !headerObj.kid) throw new Error('unsupported_jwt_alg');
  const keys = await jwks();
  const jwk = keys.find(k => k.kid === headerObj.kid);
  if (!jwk) throw new Error('jwt_kid_not_found');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, b64urlDecode(parts[2]));
  if (!ok) return null;
  const now = Math.floor(Date.now()/1000);
  if (payload.exp && payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now + 30) return null;
  if (config.oauthIssuer && payload.iss?.replace(/\/$/,'') !== config.oauthIssuer) return null;
  if (!verifyAudience(payload.aud)) return null;
  const scopes = String(payload.scope || '').split(/\s+/).filter(Boolean);
  const email = String(payload.email || '').trim().toLowerCase();
  if (!config.oauthAllowedEmails.length) return null;
  if (!email || !config.oauthAllowedEmails.includes(email)) return null;
  return { sub: payload.sub || 'oauth-user', email, scopes, payload };
}

export function hasScopes(identity, needed) {
  return needed.every(s => identity?.scopes?.includes(s));
}

export function authChallenge(scope = config.oauthScopes.join(' ')) {
  return `Bearer resource_metadata="${config.publicBaseUrl}/.well-known/oauth-protected-resource", scope="${scope}"`;
}
