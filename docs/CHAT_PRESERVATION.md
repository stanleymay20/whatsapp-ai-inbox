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


## Android-specific immediate preservation procedure (2026-11-02)

1. On the currently active Android WhatsApp Messenger, navigate to
   Settings > Chats > Chat backup, and **observe** the Google Account,
   last successful backup time, size, encryption status, and backup schedule.
   Do not overwrite a potentially older Google backup before understanding it.
2. Export indispensable individual and group chats from the Android app:
   open chat > menu > More > Export chat > Include media. Store in a
   private/encrypted archive outside the phone. Exported TXT/media files
   cannot be imported as WhatsApp-restorable chat databases and may have
   attachment limits.
3. If feasible, **copy**, never move or delete, Android local WhatsApp
   files via USB to a protected Windows drive: on many devices
   `Internal storage/Android/media/com.whatsapp/WhatsApp/Databases`,
   `.../Media`, and `.../Backups`. Local copies alone are not a
   guaranteed or supported restore method.
4. Once independently archived and confirmed there isn't a valuable
   older Android Google backup to preserve, create a fresh official
   WhatsApp backup on Google Account, with end-to-end encrypted backup.
   Save the recovery password/passkey/key privately. Google overwrites
   the previous WhatsApp backup for the same number/account.
5. Confirm the Android backup timestamp updated and key chats/photos
   remain visible in the app. Never reset or uninstall the working app
   solely to test a backup.
6. On Android browser, visit `https://account.apple.com/` or
   `https://icloud.com/` to check Apple Account access. **iCloud.com
   does not expose WhatsApp chats as a browseable chat archive or
   conclusively verify the date of WhatsApp Chat Backup.** Verification
   is generally inside WhatsApp on an iPhone (Settings > Chats >
   Chat Backup), which can entail registering the phone number and
   logging the active Android session out; do this only after step 1–5.
7. If a compatible iCloud WhatsApp backup exists, recovering it may
   require a spare/replacement iPhone, the same phone number, Apple
   Account and encryption key/password if used. Restoring iPhone data
   onto Android directly from iCloud is unsupported; WhatsApp's iPhone
   -> Android transfer expects an operational iPhone with the restored
   history and a new/reset Android device, and does **not** merge with
   newer Android chats.
8. Apple Lost Mode: `https://icloud.com/find` can be used even if the
   trusted iPhone is missing, without a 2FA code; mark device lost.
   Do not remove stolen iPhone from Find My while a theft/loss claim
   remains pending. Remote erase is irreversible and should be
   considered only with a separate security decision.

## Do-not-run list

- No WhatsApp Business migration or Meta Coexistence enrollment on the
  owner's personal Messenger phone number.
- No Android factory reset, WhatsApp uninstall, app-data clear,
  re-registration on a second iPhone, or iCloud backup deletion
  without verified independent protection of existing Android chats.
- No new cloud backups over unexamined older snapshots.
- No untrusted third-party iCloud WhatsApp extraction or chat merging
  software, and no exposure of chat exports, OTPs, passwords, backup
  keys or tokens to public repos or ChatGPT chat logs.

## Source references

- WhatsApp Android backup:
  https://faq.whatsapp.com/481135090640375
- WhatsApp Android export:
  https://faq.whatsapp.com/1180414079177245
- WhatsApp iCloud recovery:
  https://faq.whatsapp.com/618575946635920
- WhatsApp iPhone -> Android cannot merge:
  https://faq.whatsapp.com/1066696467238362
- Google Android transfer:
  https://support.google.com/android/answer/14669513
- Apple lost-device protection:
  https://support.apple.com/en-us/101593
