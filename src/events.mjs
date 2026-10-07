import crypto from 'node:crypto';
import { config } from './config.mjs';
import { canonicalJson, assertPublicHttpsUrl, constantTimeEqual, sha256 } from './util.mjs';
import { upsert, select, update, audit } from './db.mjs';

export const EVENT_DEFS = [
  {
    name: 'whatsapp.priority_detected',
    description: 'A newly received WhatsApp message was classified as important or urgent.',
    delivery: ['webhook'],
    inputSchema: { type:'object', properties:{ min_score:{ type:'integer', minimum:0, maximum:100, default:75 } }, additionalProperties:false },
    payloadSchema: { type:'object', properties:{ message_id:{type:'string'}, conversation_id:{type:'string'}, contact_name:{type:['string','null']}, sender_phone:{type:'string'}, summary:{type:'string'}, priority:{type:'string'}, score:{type:'integer'}, category:{type:'string'}, opportunity:{type:'boolean'}, action_required:{type:'boolean'}, suggested_action:{type:'string'}, deadline_iso:{type:['string','null']} }, required:['message_id','conversation_id','sender_phone','summary','priority','score','category','opportunity','action_required','suggested_action','deadline_iso'], additionalProperties:false }
  },
  {
    name: 'whatsapp.message_received',
    description: 'A new inbound WhatsApp message was received.',
    delivery: ['webhook'],
    inputSchema: { type:'object', properties:{}, additionalProperties:false },
    payloadSchema: { type:'object', properties:{ message_id:{type:'string'}, conversation_id:{type:'string'}, contact_name:{type:['string','null']}, sender_phone:{type:'string'}, preview:{type:'string'} }, required:['message_id','conversation_id','sender_phone','preview'], additionalProperties:false }
  }
];

function decodeSecret(secret) {
  if (!secret?.startsWith('whsec_')) throw new Error('invalid_webhook_secret');
  const raw = Buffer.from(secret.slice(6), 'base64');
  if (raw.length < 24 || raw.length > 64) throw new Error('invalid_webhook_secret_length');
  return raw;
}

function webhookSignature(secret, id, date, body) {
  const key = decodeSecret(secret);
  const timestamp = Math.floor(date.getTime()/1000);
  const signed = `${id}.${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', key).update(signed).digest('base64');
  return { timestamp, signature: `v1,${sig}` };
}

async function signedPost(sub, bodyObj, id) {
  await assertPublicHttpsUrl(sub.callback_url);
  const body = JSON.stringify(bodyObj);
  if (Buffer.byteLength(body) > 262144) throw new Error('event_too_large');
  const date = new Date();
  const { timestamp, signature } = webhookSignature(sub.signing_secret, id, date, body);
  return fetch(sub.callback_url, {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(10_000),
    headers:{ 'content-type':'application/json', 'webhook-id':id, 'webhook-timestamp':String(timestamp), 'webhook-signature':signature, 'x-mcp-subscription-id':sub.id },
    body
  });
}

export async function subscribeEvent(identity, params) {
  const def = EVENT_DEFS.find(x => x.name === params?.name);
  if (!def) throw Object.assign(new Error('unknown_event'), { rpcCode:-32602 });
  const delivery = params?.delivery;
  if (delivery?.mode !== 'webhook' || !delivery.url) throw Object.assign(new Error('webhook_delivery_required'), { rpcCode:-32602 });
  decodeSecret(delivery.secret);
  await assertPublicHttpsUrl(delivery.url);
  const args = params.arguments || {};
  if (params.name === 'whatsapp.priority_detected') {
    const n = args.min_score ?? config.priorityEventMinScore;
    if (!Number.isInteger(n) || n < 0 || n > 100) throw Object.assign(new Error('invalid_min_score'), { rpcCode:-32602 });
  }
  const identityMaterial = `${identity.sub}|${delivery.url}|${params.name}|${canonicalJson(args)}`;
  const id = `sub_${sha256(identityMaterial).slice(0,32)}`;
  const challenge = crypto.randomBytes(24).toString('base64url');
  const verifyId = `msg_verification_${crypto.randomUUID()}`;
  const temp = { id, callback_url:delivery.url, signing_secret:delivery.secret };
  const r = await signedPost(temp, { type:'verification', challenge }, verifyId);
  if (!r.ok) throw Object.assign(new Error(`callback_verification_http_${r.status}`), { rpcCode:-32015, reason:'challenge_failed' });
  const payload = await r.json().catch(() => ({}));
  if (!constantTimeEqual(payload.challenge || '', challenge)) throw Object.assign(new Error('callback_challenge_mismatch'), { rpcCode:-32015, reason:'challenge_failed' });
  const requested = params.ttlMs;
  const maxMs = 7 * 24 * 3600 * 1000;
  const ttl = requested == null ? maxMs : Math.min(Math.max(Number(requested), 3600_000), maxMs);
  const refreshBefore = new Date(Date.now() + ttl).toISOString();
  await upsert('mcp_event_subscriptions', [{ id, owner_sub:identity.sub, event_name:params.name, arguments:args, callback_url:delivery.url, signing_secret:delivery.secret, refresh_before:refreshBefore, active:true }], 'id');
  await audit('mcp_event_subscribed', { id, event_name:params.name }, identity.sub);
  return { id, refreshBefore, cursor:null, truncated:false };
}

export async function unsubscribeEvent(identity, params) {
  const args = params.arguments || {};
  const id = `sub_${sha256(`${identity.sub}|${params?.delivery?.url}|${params?.name}|${canonicalJson(args)}`).slice(0,32)}`;
  await update('mcp_event_subscriptions', { id:`eq.${id}`, owner_sub:`eq.${identity.sub}` }, { active:false });
  await audit('mcp_event_unsubscribed', { id }, identity.sub);
  return {};
}

export async function emitEvent(name, data) {
  let subs = [];
  try { subs = await select('mcp_event_subscriptions', `select=*&active=eq.true&event_name=eq.${encodeURIComponent(name)}&refresh_before=gt.${encodeURIComponent(new Date().toISOString())}`); }
  catch (e) { console.error('event subscription lookup failed', e.message); return; }
  for (const sub of subs || []) {
    const minScore = sub.arguments?.min_score ?? config.priorityEventMinScore;
    if (name === 'whatsapp.priority_detected' && Number(data.score) < Number(minScore)) continue;
    const event = { eventId:`evt_${crypto.randomUUID()}`, name, timestamp:new Date().toISOString(), data, cursor:null };
    try {
      const r = await signedPost(sub, event, event.eventId);
      if (r.status === 410 || r.status === 413) await update('mcp_event_subscriptions', { id:`eq.${sub.id}` }, { active:false });
      if (!r.ok) console.error('event delivery failed', sub.id, r.status);
    } catch (e) { console.error('event delivery error', sub.id, e.message); }
  }
}
