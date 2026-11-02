import { config } from './config.mjs';

function headers(extra = {}) {
  return {
    apikey: config.supabaseServiceRoleKey,
    authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function request(path, init = {}) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) throw new Error('supabase_not_configured');
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { ...init, headers: headers(init.headers) });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const err = new Error(`supabase_${response.status}: ${raw.slice(0, 800)}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function upsert(table, rows, onConflict) {
  const q = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  return request(`${table}${q}`, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
}

export async function insert(table, rows) {
  return request(table, { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(rows) });
}

export async function update(table, filters, patch) {
  const q = new URLSearchParams(filters).toString();
  return request(`${table}?${q}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(patch) });
}

export async function select(table, query = '') {
  return request(`${table}${query ? `?${query}` : ''}`, { method: 'GET' });
}

export async function rpc(name, params = {}) {
  return request(`rpc/${name}`, { method: 'POST', body: JSON.stringify(params) });
}

export async function audit(action, details = {}, actor = 'system') {
  try { await insert('audit_log', [{ actor, action, details }]); } catch (err) { console.error('audit failed', err.message); }
}
