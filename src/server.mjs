import http from 'node:http';
import crypto from 'node:crypto';
import { config, assertCoreConfig } from './config.mjs';
import { readBody, safeJsonParse, json, text, constantTimeEqual } from './util.mjs';
import { handleMcp } from './mcp.mjs';
import { processWebhook, verifyMetaSignature } from './whatsapp.mjs';
import { oauthConsentHtml } from './oauth-ui.mjs';

try { assertCoreConfig(); } catch (e) { console.warn(`CONFIG WARNING: ${e.message}`); }

function oauthConsent(res) {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const body = oauthConsentHtml(nonce);
  const supabaseOrigin = config.supabaseUrl || 'https://invalid.example';
  res.writeHead(200, {
    'content-type':'text/html; charset=utf-8',
    'content-length':Buffer.byteLength(body),
    'cache-control':'no-store, max-age=0',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
    'referrer-policy':'no-referrer',
    'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
    'content-security-policy':`default-src 'none'; script-src https://cdn.jsdelivr.net 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src ${supabaseOrigin}; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok:true, service:'whatsapp-ai-inbox', version:'0.2.0', time:new Date().toISOString() });
    if (req.method === 'GET' && url.pathname === '/oauth/consent') return oauthConsent(res);
    if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') {
      return json(res, 200, { resource:config.publicBaseUrl, authorization_servers:config.oauthIssuer?[config.oauthIssuer]:[], scopes_supported:config.oauthScopes, resource_documentation:`${config.publicBaseUrl}/docs` });
    }
    if (url.pathname === '/webhooks/whatsapp' && req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token') || '';
      const challenge = url.searchParams.get('hub.challenge') || '';
      if (mode === 'subscribe' && config.whatsappVerifyToken && constantTimeEqual(token, config.whatsappVerifyToken)) return text(res, 200, challenge);
      return text(res, 403, 'Forbidden');
    }
    if (url.pathname === '/webhooks/whatsapp' && req.method === 'POST') {
      const raw = await readBody(req, 2_000_000);
      if (!verifyMetaSignature(raw, req.headers['x-hub-signature-256'])) return text(res, 401, 'Invalid signature');
      const payload = safeJsonParse(raw);
      // Acknowledge Meta quickly; process asynchronously in this process.
      res.writeHead(200, { 'content-type':'text/plain' }); res.end('EVENT_RECEIVED');
      processWebhook(payload).catch(e => console.error('Webhook processing failed', e));
      return;
    }
    if (url.pathname === '/mcp' && req.method === 'POST') {
      const raw = await readBody(req, 1_000_000);
      return handleMcp(req, res, safeJsonParse(raw));
    }
    if (url.pathname === '/mcp' && req.method === 'GET') return json(res, 405, { error:'Use POST for MCP streamable HTTP requests.' });
    if (url.pathname === '/docs' && req.method === 'GET') return text(res, 200, 'WhatsApp AI Inbox MCP connector. See repository README for setup and privacy/security notes.');
    return json(res, 404, { error:'not_found' });
  } catch (e) {
    console.error('request failed', e);
    if (!res.headersSent) return json(res, e.statusCode || 500, { error:e.message || 'internal_error' });
    res.end();
  }
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`WhatsApp AI Inbox listening on :${config.port}`);
});
