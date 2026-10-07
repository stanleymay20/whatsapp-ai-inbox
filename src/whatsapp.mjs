import crypto from 'node:crypto';
import { config } from './config.mjs';
import { upsert, update, select, audit } from './db.mjs';
import { classifyMessage, classifyMessageFallback } from './openai.mjs';
import { emitEvent } from './events.mjs';
import { constantTimeEqual } from './util.mjs';

export function verifyMetaSignature(raw, signatureHeader) {
  if (!config.metaAppSecret) throw new Error('META_APP_SECRET_missing');
  const expected = `sha256=${crypto.createHmac('sha256', config.metaAppSecret).update(raw).digest('hex')}`;
  return constantTimeEqual(expected, signatureHeader || '');
}

function conversationId(phone) {
  return `wa_${crypto.createHash('sha256').update(phone).digest('hex').slice(0,32)}`;
}

function contactName(value, phone) {
  const c = (value.contacts || []).find(x => x.wa_id === phone);
  return c?.profile?.name || null;
}

function messageText(m) {
  if (m.type === 'text') return m.text?.body || '';
  if (m.type === 'button') return m.button?.text || '';
  if (m.type === 'interactive') return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
  if (m.type === 'image') return m.image?.caption || '[Image]';
  if (m.type === 'document') return m.document?.caption || `[Document: ${m.document?.filename || 'file'}]`;
  if (m.type === 'audio') return '[Audio message]';
  if (m.type === 'video') return m.video?.caption || '[Video]';
  if (m.type === 'sticker') return '[Sticker]';
  if (m.type === 'location') return `[Location${m.location?.name ? `: ${m.location.name}` : ''}]`;
  return `[${m.type || 'Unsupported message'}]`;
}

async function storeClassification(row, cid, name, phone, classification) {
  await upsert('message_priority', [{ message_id:row.id, ...classification, deadline_at:classification.deadline_iso || null }], 'message_id');
  if (classification.score >= config.priorityEventMinScore) {
    emitEvent('whatsapp.priority_detected', { message_id:row.id, conversation_id:cid, contact_name:name, sender_phone:phone, summary:classification.short_summary, priority:classification.priority, score:classification.score, category:classification.category, opportunity:classification.opportunity, action_required:classification.action_required, suggested_action:classification.suggested_action, deadline_iso:classification.deadline_iso }).catch(console.error);
  }
}

async function storeInbound(value, m, source = 'cloud_api') {
  const phone = m.from;
  if (!phone || !m.id) return;
  const cid = conversationId(phone);
  const name = contactName(value, phone);
  const ts = new Date(Number(m.timestamp || Math.floor(Date.now()/1000))*1000).toISOString();
  const body = messageText(m);
  await upsert('contacts', [{ whatsapp_id:phone, display_name:name, updated_at:new Date().toISOString() }], 'whatsapp_id');
  await upsert('conversations', [{ id:cid, contact_whatsapp_id:phone, last_message_at:ts, last_inbound_at:ts, updated_at:new Date().toISOString() }], 'id');
  const stored = await upsert('messages', [{ meta_message_id:m.id, conversation_id:cid, direction:'inbound', source, message_type:m.type || 'unknown', body, sent_at:ts, raw:m }], 'meta_message_id');
  const row = stored?.[0];
  if (!row) return;
  emitEvent('whatsapp.message_received', { message_id:row.id, conversation_id:cid, contact_name:name, sender_phone:phone, preview:body.slice(0,300) }).catch(console.error);
  let classification;
  let classifier = 'openai';
  try {
    const recent = await select('messages', `select=direction,body,sent_at&conversation_id=eq.${cid}&order=sent_at.desc&limit=8`);
    classification = await classifyMessage({ sender:{ phone, name }, body, timestamp:ts, recentContext:(recent||[]).reverse() });
  } catch (e) {
    classifier = 'deterministic_fallback';
    classification = classifyMessageFallback({ body });
    console.warn('priority classification fallback', e.message);
  }
  try {
    await storeClassification(row, cid, name, phone, classification);
  } catch (e) {
    console.error('priority persistence failed', e.message);
  }
  await audit('whatsapp_message_received', { message_id:row.id, meta_message_id:m.id, classifier, classification }, 'meta-webhook');
}

async function storeStatus(s) {
  if (!s?.id || !s?.status) return;
  await update('messages', { meta_message_id:`eq.${s.id}` }, { delivery_status:s.status, status_updated_at:new Date().toISOString() });
}

async function storeEcho(value, echo) {
  const phone = echo.to || echo.recipient_id || echo.from;
  const mid = echo.id || echo.message_id;
  if (!phone || !mid) return;
  const cid = conversationId(phone);
  const ts = new Date(Number(echo.timestamp || Math.floor(Date.now()/1000))*1000).toISOString();
  const body = echo.text?.body || echo.text || '[Business app message]';
  await upsert('contacts', [{ whatsapp_id:phone, updated_at:new Date().toISOString() }], 'whatsapp_id');
  await upsert('conversations', [{ id:cid, contact_whatsapp_id:phone, last_message_at:ts, last_outbound_at:ts, updated_at:new Date().toISOString() }], 'id');
  await upsert('messages', [{ meta_message_id:mid, conversation_id:cid, direction:'outbound', source:'business_app_echo', message_type:echo.type || 'text', body, sent_at:ts, raw:echo }], 'meta_message_id');
}

export async function processWebhook(payload) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const m of value.messages || []) await storeInbound(value, m, 'cloud_api');
      for (const s of value.statuses || []) await storeStatus(s);
      const echoes = value.message_echoes || value.smb_message_echoes || [];
      for (const echo of Array.isArray(echoes) ? echoes : (echoes.messages || [])) await storeEcho(value, echo);
      const historyItems = value.history?.messages || value.history || [];
      if (Array.isArray(historyItems)) {
        for (const h of historyItems) {
          if (!h?.id || !h?.from) continue;
          const phone = h.from;
          const cid = conversationId(phone);
          const ts = new Date(Number(h.timestamp || Math.floor(Date.now()/1000))*1000).toISOString();
          await upsert('contacts', [{ whatsapp_id:phone, updated_at:new Date().toISOString() }], 'whatsapp_id');
          await upsert('conversations', [{ id:cid, contact_whatsapp_id:phone, last_message_at:ts, updated_at:new Date().toISOString() }], 'id');
          await upsert('messages', [{ meta_message_id:h.id, conversation_id:cid, direction:h.direction || 'inbound', source:'coexistence_history', message_type:h.type || 'unknown', body:messageText(h), sent_at:ts, raw:h }], 'meta_message_id');
        }
      }
    }
  }
}

export async function sendText({ to, text }) {
  if (!config.whatsappAccessToken || !config.phoneNumberId) throw new Error('whatsapp_send_not_configured');
  const r = await fetch(`https://graph.facebook.com/${config.metaGraphVersion}/${config.phoneNumberId}/messages`, {
    method:'POST',
    headers:{ authorization:`Bearer ${config.whatsappAccessToken}`, 'content-type':'application/json' },
    body:JSON.stringify({ messaging_product:'whatsapp', recipient_type:'individual', to, type:'text', text:{ body:text, preview_url:false } })
  });
  const payload = await r.json();
  if (!r.ok) throw new Error(`meta_send_${r.status}: ${JSON.stringify(payload).slice(0,800)}`);
  return payload;
}

export { conversationId };
