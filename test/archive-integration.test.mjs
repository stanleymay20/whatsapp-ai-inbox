import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareArchivePayload, MAX_ARCHIVE_BYTES } from '../src/archive.mjs';
import { handleMcp } from '../src/mcp.mjs';

test('archive request safely parses a synthetic WhatsApp export', () => {
  const source = '02/11/2026, 10:00 - Test Sender: Interview opportunity\n03/11/2026, 11:00 - Me: Thanks';
  const a = prepareArchivePayload({filename:'WhatsApp Chat with Test Sender.txt',source_text:source});
  assert.equal(a.p_entries.length,2);
  assert.equal(a.p_entries[0].author,'Test Sender');
  assert.match(a.p_source_sha256,/^[0-9a-f]{64}$/);
  assert.equal(a.p_source_filename,'WhatsApp Chat with Test Sender.txt');
});
test('archive input cannot be a path traversal or non-text source', () => {
  assert.throws(() => prepareArchivePayload({filename:'../../private.txt',source_text:'hello'}), /invalid_filename/);
  assert.throws(() => prepareArchivePayload({filename:'test.zip',source_text:'hello'}), /invalid_filename/);
  assert.throws(() => prepareArchivePayload({filename:'test.txt',source_text:''}), /invalid_source_size/);
});
test('archive import size and entry bounds are enforced without truncation', () => {
  const tooLarge = 'x'.repeat(MAX_ARCHIVE_BYTES + 1);
  assert.throws(() => prepareArchivePayload({filename:'chat.txt',source_text:tooLarge}), /invalid_source_size/);
  const many = Array.from({length:5001},(_,i) => '02/11/2026, 10:00 - Test: '+i).join('\n');
  assert.throws(() => prepareArchivePayload({filename:'chat.txt',source_text:many}), /invalid_entry_count/);
});
test('MCP tools/list exposes three read-only archive search tools', async () => {
  const messages=[];
  const res={
    writeHead(status,headers){this.status=status;this.headers=headers},
    end(data){messages.push(data)}
  };
  await handleMcp({headers:{}},res,{jsonrpc:'2.0',method:'tools/list',id:12});
  const returned = JSON.parse(messages[0]);
  assert.equal(res.status,200);
  for (const name of ['list_archived_whatsapp_chats','search_archived_whatsapp','get_archived_whatsapp_chat']) {
    const t=returned.result.tools.find(t=>t.name===name);
    assert.ok(t, 'missing '+name);
    assert.equal(t.annotations.readOnlyHint,true);
  }
});
