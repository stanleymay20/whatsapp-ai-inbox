# ChatGPT Sites & Plugin Creator brief — Private WhatsApp Archive Search

## Goal
Create a **private ChatGPT Site and read-only plugin** for the owner's explicitly exported WhatsApp Messenger chats. Keep the original Android phone, Google backup, and lost-iPhone iCloud recovery options unchanged. No live WhatsApp sync.

## Existing resources
- GitHub: https://github.com/stanleymay20/whatsapp-ai-inbox
- Render origin: https://whatsapp-ai-inbox-staging.onrender.com
- New read-only MCP (after this branch merges/deploys): https://whatsapp-ai-inbox-staging.onrender.com/mcp/archive
- Existing full Business MCP **DO NOT USE FOR THE PERSONAL PLUGIN**: /mcp
- Supabase project: kpayqqfbywxfhwzrztrn
- OAuth consent screen: https://whatsapp-ai-inbox-staging.onrender.com/oauth/consent
- OAuth issuer / authorization server: https://kpayqqfbywxfhwzrztrn.supabase.co/auth/v1
- OAuth client is NOT registered; callback URL has not been received
- Export importer: /archive (disabled by default)

## Plugin Creator prompt
Create a **private** plugin named "WhatsApp Archive Search" for my ChatGPT Plus account.
Use ChatGPT Sites to host its MCP app if needed. Reuse my existing
WhatsApp AI Inbox read-only HTTPS endpoint, not a new Business WhatsApp API.
Expose exactly these tools:
  - list_archived_whatsapp_chats
  - search_archived_whatsapp
  - get_archived_whatsapp_chat
Use OAuth 2.1 with explicit owner consent and an exact callback URI supplied
by the plugin/Site runtime. Never invent a redirect URI, hardcode secrets,
grant untrusted visitors access, enable dynamic OAuth registration without
review, or make message-sending actions available. The data source contains
only explicitly imported exports, so ALWAYS say "archived snapshots, not live WhatsApp".
Build/test with synthetic data, keep the plugin private, and show me the final
connection details before any real chat imports.

## ChatGPT Site instructions
1. Create a private Site named "WhatsApp Archive Search".
2. Add an MCP plugin hosting three read-only tools, or an explicitly
   documented secure bridge to the above archive-only MCP server.
3. The Site's external service connection must support real owner OAuth.
   If it can't proxy or access a secured external MCP endpoint, STOP and
   report the limitation. Do not insert a service_role credential into
   browser scripts or ship it inside a Site frontend.
4. Only the owner may view/execute these tools. Do not publicly publish or
   share the Site/plugin permissions with other people.
5. Show search box, imported chat list, selected transcript excerpts,
   date labels, and a prominent "Not live WhatsApp" disclaimer.
6. Test with synthetic chat text only. Verify no outbound WhatsApp tools.
7. Owner must publish the Site and install/connect the resulting plugin.
8. Verify exact OAuth redirect URI at connection time; if needed, create a
   client in Supabase Auth > OAuth Apps with only that exact URI.

## Remaining security and activation requirements
- Check Render env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY,
  OAUTH_ISSUER, OAUTH_JWKS_URI, OAUTH_AUDIENCE and OAUTH_ALLOWED_EMAILS.
- Disable ALLOW_INSECURE_NOAUTH and DEV_BEARER_TOKEN in staging.
- Confirm the Supabase owner password login works (confirmed email alone
  does NOT prove successful login).
- Test valid and invalid signed bearer tokens and cross-user isolation.
- Enable ENABLE_PERSONAL_ARCHIVE_IMPORT only after tests pass.
- Review encrypted storage, retention and deletion workflows before importing
  real conversations (the current archive stores plaintext message fields
  within the provider-managed database).
- This is not a recovery path for old iPhone chats or a WhatsApp backup.
- Do not link any unofficial WhatsApp QR session or migrate personal Messenger
  to WhatsApp Business.

Official docs (verified Nov 2, 2026):
- https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
