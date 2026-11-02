import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsAppExport } from '../scripts/archive-parser.mjs';

test('Android export preserves multiline, systems and colons', () => {
  const input = '01/11/2026, 20:01 - Messages and calls are end-to-end encrypted.\n01/11/2026, 20:02 - Judith: Hi: have you seen this?\nThe second line belongs to the same message.\n02/11/2026, 08:15 - Me: Yes\n';
  const out = parseWhatsAppExport(input, { filename: 'synthetic-example.txt' });
  assert.equal(out.total_entries, 3);
  assert.equal(out.messages[0].kind, 'system');
  assert.equal(out.messages[1].author, 'Judith');
  assert.equal(out.messages[1].body, 'Hi: have you seen this?\nThe second line belongs to the same message.');
  assert.equal(out.messages[1].source_line_end, 3);
  assert.match(out.source_sha256, /^[0-9a-f]{64}$/);
});
test('Bracketed exports preserve AM/PM date ambiguity', () => {
  const input = '[11/2/26, 9:34:55 AM] Alice: Hi\n[11/2/26, 9:35:01 AM] Bob: Hello\n';
  const out = parseWhatsAppExport(input);
  assert.equal(out.total_entries, 2);
  assert.equal(out.messages[0].timestamp_raw, '11/2/26, 9:34:55 AM');
  assert.equal(out.messages[0].author, 'Alice');
  assert.equal(out.messages[1].author, 'Bob');
});
test('Unexpected initial text is retained rather than discarded', () => {
  const out = parseWhatsAppExport('Unknown header\n02/11/2026, 11:00 - Me: hello');
  assert.equal(out.messages[0].kind, 'unparsed');
  assert.equal(out.messages[0].body, 'Unknown header');
  assert.equal(out.total_entries, 2);
});
test('Same export creates the same local archive contents', () => {
  const source = '02/11/2026, 11:00 - Me: hello';
  assert.deepEqual(parseWhatsAppExport(source), parseWhatsAppExport(source));
});
