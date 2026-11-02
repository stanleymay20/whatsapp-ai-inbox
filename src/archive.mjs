import { config } from './config.mjs';
import { verifyBearer } from './auth.mjs';
import { parseWhatsAppExport } from '../scripts/archive-parser.mjs';
import { rpc } from './db.mjs';
import { json } from './util.mjs';

export const MAX_ARCHIVE_BYTES = 1_500_000;
export const MAX_ARCHIVE_ENTRIES = 5000;

export function prepareArchivePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_request');
  const { filename, source_text: text } = input;
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 180
    || /[\/\\\u0000-\u001f]/u.test(filename) || !/\.txt$/i.test(filename)) {
    throw new Error('invalid_filename');
  }
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text, 'utf8') > MAX_ARCHIVE_BYTES) {
    throw new Error('invalid_source_size');
  }
  const archive = parseWhatsAppExport(text, { filename });
  if (archive.total_entries < 1 || archive.total_entries > MAX_ARCHIVE_ENTRIES) throw new Error('invalid_entry_count');
  for (const e of archive.messages) {
    if (e.body.length > 16000 || (e.author || '').length > 180
      || (e.timestamp_raw || '').length > 120) throw new Error('entry_too_large');
  }
  return {
    p_source_sha256: archive.source_sha256,
    p_source_filename: filename,
    p_entries: archive.messages,
  };
}

export async function handleArchiveImport(req, res, raw) {
  // Fail closed: normal Messenger archive import must never be anonymous or
  // enabled accidentally on a staging service without an owner allowlist.
  if (!config.enablePersonalArchiveImport || config.allowInsecureNoAuth
      || !config.oauthAllowedEmails.length || !config.oauthIssuer || !config.oauthAudience) {
    return json(res, 503, { error:'archive_import_disabled' }, { 'cache-control':'no-store' });
  }
  let identity;
  try { identity = await verifyBearer(req.headers.authorization); } catch { identity = null; }
  if (!identity || !identity.email || !identity.sub || identity.sub === 'dev-token') {
    return json(res, 401, { error:'owner_authentication_required' }, {
      'cache-control':'no-store', 'www-authenticate':'Bearer'
    });
  }
  let payload;
  try {
    payload = prepareArchivePayload(JSON.parse(raw.toString('utf8')));
  } catch (e) {
    return json(res, 400, { error: [
      'invalid_request', 'invalid_filename', 'invalid_source_size',
      'invalid_entry_count', 'entry_too_large'
    ].includes(e.message) ? e.message : 'invalid_request' }, { 'cache-control':'no-store' });
  }
  try {
    const stored = await rpc('ingest_whatsapp_archive', { p_owner_sub:identity.sub, ...payload });
    // Never return message text or raw exports in the upload response or logs.
    return json(res, 200, {
      import_id:stored.import_id,
      duplicate:Boolean(stored.duplicate),
      entry_count:stored.entry_count,
      source_sha256:payload.p_source_sha256
    }, { 'cache-control':'no-store' });
  } catch {
    return json(res, 503, { error:'archive_storage_unavailable' }, { 'cache-control':'no-store' });
  }
}
