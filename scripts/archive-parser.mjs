import crypto from 'node:crypto';

// WhatsApp exports have locale-dependent date ordering. Preserve timestamps as-is.
const HEADER = /^\s*(?:\[([^\]]+)\]\s*|((?:\d{1,4}[\/.\-]){2}\d{1,4})\s*,\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aApP]\.?(?:m|M)\.?)?)\s*[-–]\s*)(.*)$/u;
const SPEAKER = /^([^:\r\n]{1,180}):\s(.*)$/u;

export function parseWhatsAppExport(source, { filename = 'WhatsApp Chat.txt' } = {}) {
  if (typeof source !== 'string') throw new TypeError('WhatsApp export must be UTF-8 text');
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const entries = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^[\u200e\u200f]+/u, '');
    const match = HEADER.exec(line);
    if (match) {
      const stamp = match[1] || (match[2] + ', ' + match[3]);
      const rest = match[4];
      const speaker = SPEAKER.exec(rest);
      current = {
        timestamp_raw: stamp,
        author: speaker ? speaker[1] : null,
        body: speaker ? speaker[2] : rest,
        kind: speaker ? 'message' : 'system',
        source_line_start: i + 1,
        source_line_end: i + 1,
      };
      entries.push(current);
    } else if (current) {
      if (i === lines.length - 1 && line === '') continue;
      current.body += '\n' + line;
      current.source_line_end = i + 1;
    } else if (line.trim()) {
      // Never silently discard unfamiliar leading lines.
      entries.push({ timestamp_raw: null, author: null, body: line,
        kind: 'unparsed', source_line_start: i + 1, source_line_end: i + 1 });
    }
  }
  return {
    format: 'whatsapp-export-archive-v1',
    source_filename: filename,
    source_sha256: crypto.createHash('sha256').update(Buffer.from(source, 'utf8')).digest('hex'),
    preservation: 'read-only source; archive does not modify WhatsApp or any cloud backup',
    notes: [
      'Raw timestamps preserved; locale/date order is not inferred.',
      'System and unparsed entries are preserved.',
      'Media attachment bytes are not included in this text parser.',
      'Do not upload this archive to a public repository or untrusted service.',
    ],
    total_entries: entries.length,
    messages: entries,
  };
}
