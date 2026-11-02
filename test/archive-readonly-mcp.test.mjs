import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveToolAllowed, handleMcp } from '../src/mcp.mjs';
import { config } from '../src/config.mjs';

async function invoke(method, params, archiveOnly) {
  const response = {status:null, headers:null, body:null,
    setHeader() {},
    writeHead(status,headers) {this.status=status; this.headers=headers;},
    end(s) {this.body=s;}
  };
  await handleMcp({headers:{}}, response, {jsonrpc:'2.0', id:1, method, params}, {archiveOnly});
  return { ...response, parsed:response.body?JSON.parse(response.body):null };
}

test('public tool scanning of read-only endpoint advertises ONLY archive reads',async () => {
  const r=await invoke('tools/list',{},true);
  assert.equal(r.status,200);
  assert.deepEqual(r.parsed.result.tools.map(t=>t.name).sort(),[
    'get_archived_whatsapp_chat','list_archived_whatsapp_chats','search_archived_whatsapp'
  ]);
  for(const t of r.parsed.result.tools)assert.equal(t.annotations.readOnlyHint,true);
});

test('archive endpoint rejects Business send and write tools at dispatch (even if requested)',async () => {
  for(const name of ['send_approved_reply','approve_reply','create_reply_draft','get_profile','search_whatsapp']) {
    assert.equal(archiveToolAllowed(name),false);
    const r=await invoke('tools/call',{name,arguments:{}},true);
    assert.equal(r.parsed.error.code,-32601,name);
  }
});

test('archive endpoint refuses subscriptions, event hooks and unrelated methods',async () => {
  for(const method of ['events/subscribe','events/list','events/unsubscribe','logging/setLevel']) {
    const r=await invoke(method,{},true);
    assert.equal(r.parsed.error.code,-32601,method);
  }
});

test('archive endpoint needs authorization before reading archive data',async () => {
  assert.equal(archiveToolAllowed('search_archived_whatsapp'),true);
  const r=await invoke('tools/call',{name:'search_archived_whatsapp',arguments:{query:'test'}},true);
  assert.equal(r.status,401);
  assert.equal(r.parsed.error.code,-32001);
});

test('legacy MCP endpoint still lists existing Business tools', async() => {
  const r=await invoke('tools/list',{},false);
  const names=r.parsed.result.tools.map(t=>t.name);
  assert.ok(names.includes('get_profile'));
  assert.ok(names.includes('send_approved_reply'));
  assert.ok(names.includes('search_archived_whatsapp'));
});

test('archive-only MCP refuses development bearer token bypass configuration', async () => {
  const prior = config.devBearerToken;
  try {
    config.devBearerToken = 'only-a-fabricated-test-value';
    const r = await invoke('tools/list',{},true);
    assert.equal(r.status,503);
    assert.equal(r.parsed.error.code,-32002);
  } finally { config.devBearerToken = prior; }
});
