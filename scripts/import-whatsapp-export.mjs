#!/usr/bin/env node
import { readFile, open, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseWhatsAppExport } from './archive-parser.mjs';

function usage() {
  console.error('Usage: node scripts/import-whatsapp-export.mjs --input /private/chat.txt --output /private/chat-archive.json');
  console.error('Output contains private message text. Store only in a secure, non-shared folder.');
}

async function main() {
  const pairs = process.argv.slice(2);
  if (pairs.length !== 4 || !['--input','--output'].every(flag => pairs.includes(flag))) {
    usage(); process.exitCode = 2; return;
  }
  const opts = {};
  for (let i = 0; i < pairs.length; i += 2) {
    if (!['--input', '--output'].includes(pairs[i]) || !pairs[i+1] || opts[pairs[i]]) {
      usage(); process.exitCode = 2; return;
    }
    opts[pairs[i]] = pairs[i+1];
  }
  const inputFile = path.resolve(opts['--input']);
  const outputFile = path.resolve(opts['--output']);
  if (inputFile === outputFile || !inputFile.toLowerCase().endsWith('.txt') || !outputFile.toLowerCase().endsWith('.json')) {
    throw new Error('Use distinct .txt input and .json output paths. Original exports are never modified.');
  }
  const meta = await stat(inputFile);
  if (!meta.isFile() || meta.size > 100 * 1024 * 1024) throw new Error('Input must be a .txt file no larger than 100 MiB.');
  const data = await readFile(inputFile, 'utf8');
  const archive = parseWhatsAppExport(data, { filename: path.basename(inputFile) });
  // wx means an existing archive can never be overwritten accidentally.
  const handle = await open(outputFile, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(archive, null, 2) + '\n', 'utf8');
  } finally { await handle.close(); }
  console.log('Parsed ' + archive.total_entries + ' entries. SHA-256: ' + archive.source_sha256);
  console.log('Saved local archive. Original WhatsApp export was not modified.');
  console.log('No content was uploaded to Supabase, OpenAI or another server.');
}

main().catch(err => { console.error('Import failed: ' + err.message); process.exitCode = 1; });
