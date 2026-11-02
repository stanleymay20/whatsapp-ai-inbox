# No-Loss WhatsApp Recovery & Preservation Policy

Reviewed: 2026-11-02
Current owner state: lost iPhone 16e; now using ordinary WhatsApp Messenger.
**This repository is NOT connected to that ordinary WhatsApp Messenger account.**

## Non-negotiable rule

**Do not connect, register, migrate, convert, reset, uninstall, import, erase or
overwrite anything related to the owner's WhatsApp account or Apple/iCloud
backups without checking recoverability and obtaining specific approval.**

Meta's WhatsApp Cloud API and Business App Coexistence path in this repo must
not be applied to the owner's existing ordinary WhatsApp Messenger account.
This code does not provide a supported full-history export from WhatsApp
Messenger. Do not claim any historical messages have been saved in Supabase.
The dedicated Supabase project had zero stored messages and conversations when
read on 2026-11-02.

## Recoverability checklist (do not execute destructive steps)

1. Establish the current WhatsApp client/device: replacement iPhone, Android,
   Windows, or another setup; establish whether WhatsApp is registered/linked.
2. Confirm which old chats, groups, documents, media, voice notes and dates are
   missing and whether newly received chats are important.
3. Inspect (read-only) whether an iCloud WhatsApp backup of the old iPhone
   exists, its date, size and Apple Account; do not start a new empty iCloud
   WhatsApp backup that could overwrite a valuable previous one.
4. If Apple Account access is blocked by an inaccessible trusted number,
   recover it through Apple's official account recovery instructions, not a
   third-party unlocker.
5. Check whether the WhatsApp backup was end-to-end encrypted; identify
   whether the owner still has the password, passkey or recovery key.
6. Preserve any *current* new messages independently before restoring old
   history: export important chats with media and store locally in a private,
   encrypted location. A chat export is an archive, **not** a backup that
   WhatsApp can import or merge into its chat database.
7. For iPhone-to-iPhone recovery, a compatible existing iCloud backup can be
   restored using the same phone number and Apple Account during WhatsApp
   initial setup. Do NOT uninstall until preservation of the current device
   state is complete.
8. For iPhone-to-Android, **an iCloud WhatsApp backup cannot be restored
   directly on Android**. WhatsApp's supported transfer typically requires
   physical access to the source iPhone and a new/reset Android during device
   setup. With the source iPhone lost, a recovered iCloud backup on a
   replacement iPhone may be an intermediate step; protect new Android chats
   separately before any transfer.
9. Do not assume messages missing after the last valid backup are recoverable.
   WhatsApp states it does not keep the chat history on its servers for later
   restoration. Where needed, ask correspondents to resend important content.
10. Only revisit Meta onboarding after a separate preservation decision and
    preferably with a distinct business account/number. Personal WhatsApp
    should remain untouched.

## Preservation architecture for a future ChatGPT integration

Use a **read-only archive** of user-provided WhatsApp chat exports, with
explicit import approval. Store files encrypted at rest, avoid public bucket
access, redact unrelated third-party data when possible, log access and
deletion, and verify completeness and checksums. ChatGPT searches a copy, not
a migrated phone account. No archive import or extraction is implemented yet.

## Official help

- WhatsApp iPhone recovery:
  https://faq.whatsapp.com/618575946635920
- WhatsApp missing/corrupted backup:
  https://faq.whatsapp.com/589979312881396/
- WhatsApp iPhone to Android limitations:
  https://faq.whatsapp.com/1066696467238362/
- Apple lost trusted number recovery:
  https://support.apple.com/en-gb/122621
- Apple account recovery:
  https://support.apple.com/en-us/102656
