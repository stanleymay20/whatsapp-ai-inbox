# Read-only WhatsApp Messenger export path (Android)

This branch adds an **offline-only** text archive parser for normal WhatsApp
Messenger. It does not connect to WhatsApp servers, access the Android app
database, read iCloud, or register the owner's phone number with Meta.
No WhatsApp messages have been uploaded to the project.

## Use

On Android:
1. In WhatsApp Messenger, open one chat, choose the menu > More > Export chat.
2. Select **Without media** for a small text-only trial, or **Include media** if
   you also want a separate copy of the included media files. Save privately.
3. Preserve the original ZIP/text export, unmodified, in an encrypted folder.
4. For a ZIP export, use trusted built-in extraction and locate the .txt file.
5. On your own computer with Node 22+, run:

   node scripts/import-whatsapp-export.mjs --input "/private/WhatsApp Chat.txt" --output "/private/WhatsApp Chat.archive.json"

6. The command refuses to overwrite any existing archive, preserves source
   timestamps unchanged and reports SHA-256 plus message counts.
7. You may **choose** to attach a *selected* export or JSON archive to a
   ChatGPT conversation to analyse it. This is not automatic syncing, and
   sending it to ChatGPT is a separate privacy decision.

## Scope / limitations

- Only chats you separately export are included.
- WhatsApp may limit exported text and attachments; no "all chats" API exists
  for a personal Messenger account. You must export each chat separately.
- Text archives are **not** WhatsApp restorable backups and cannot recover
  deleted chats or lost iPhone-only messages.
- This parser does not examine, copy, import or index ZIP media attachments.
- Locale-dependent raw timestamps are intentionally not normalized to ISO.
- Chat exports include the other participants' private content; carefully
  select data to share with ChatGPT and avoid sensitive third-party content.
- The parser is a local tool, not an integrated ChatGPT plugin.
- Never commit personal exports, tokens, backup passwords or imported JSON
  to GitHub, Render, public storage or this repository.

## Official alternative for ChatGPT messaging *inside* WhatsApp

OpenAI announced on July 13, 2026 that EEA WhatsApp numbers can message the
official verified ChatGPT contact at +1-800-242-8478, subject to country-code
eligibility and gradual rollout. That opens a **new** ChatGPT conversation
and cannot read all other private WhatsApp chats.

Reference: https://help.openai.com/en/articles/6825453-chatgpt-release-notes

## Next engineering phase (NOT DONE)

Build a private owner-authenticated archive store, import previews,
access-control policies, GDPR-conscious retention/deletion, and a
read-only ChatGPT Sites-hosted plugin for searching only explicitly
imported chats. Confirm actual client compatibility and deployment before
claiming live access. Do not enable the legacy Meta Business webhook for
the owner's ordinary Messenger account.

Reference: https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
