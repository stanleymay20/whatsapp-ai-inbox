# WhatsApp AI Inbox — Connection and Go-Live Runbook

Last reviewed: 2026-11-02

## Objective

Verify one authentic WhatsApp Business inbound message reaches the Supabase
database and can be retrieved using an authenticated client. Do not claim
"WhatsApp connected to ChatGPT" until a supported ChatGPT client has authenticated
and successfully called the MCP search/conversation tools.

## Known deployed resources

- GitHub: `stanleymay20/whatsapp-ai-inbox`
- Implementation branch: `deploy/v0.2` (PR #1, not merged)
- Render staging service: `whatsapp-ai-inbox-staging`
- HTTPS origin: `https://whatsapp-ai-inbox-staging.onrender.com`
- MCP: `https://whatsapp-ai-inbox-staging.onrender.com/mcp`
- Meta webhook: `https://whatsapp-ai-inbox-staging.onrender.com/webhooks/whatsapp`
- Supabase project name: `whatsapp-ai-inbox`

At review: Render's latest deployment was marked live (Oct 7) at commit
`58cc41601e2c0d046b5dea2b7d6e9955d3f05fac`; this is not an
end-to-end connectivity test. Supabase was inactive; its restoration request
succeeded on Nov 2 and its reported status became `COMING_UP`. Recheck
the status before querying.

## Account compatibility: do this first

The Meta Cloud API plus Coexistence flow is for eligible **WhatsApp Business
App** accounts. It is not a direct sync of ordinary WhatsApp Messenger inboxes.
Do not delete, unregister, or migrate a personal WhatsApp number to make the
integration work. Confirm the account type and Meta eligibility in the
official onboarding flow, ideally with a dedicated business number.

Also distinguish two different goals:

1. **Chatting with ChatGPT in WhatsApp**: an official OpenAI service may be
   offered for eligible EEA phone numbers, but it does not import or search all
   of the user's WhatsApp conversations.
2. **Searching private WhatsApp conversations from ChatGPT**: this repository
   targets Meta's WhatsApp Business API and an authenticated custom MCP server.
   As of November 2, 2026, OpenAI's documented full custom MCP plugin support
   is for eligible Business and Enterprise/Edu workspaces (and Pro supports
   read/fetch-only custom MCP); Plus access should **not** be assumed.

Sources:
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup

## Required configuration — secrets belong ONLY in Render

In Render service environment, set:

- `PUBLIC_BASE_URL`: exact staging HTTPS origin
- `SUPABASE_URL`: dedicated project URL
- `SUPABASE_PUBLISHABLE_KEY`: public auth key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only privileged key
- `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URI`
- `OAUTH_ALLOWED_EMAILS`: exact owner email (no public access)
- `OAUTH_REQUIRED_SCOPES`: scope supported by Supabase Auth
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_PHONE_E164`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- Optional: `OPENAI_API_KEY`, `OPENAI_MODEL` for semantic AI features

Production safety invariants:
`ALLOW_INSECURE_NOAUTH=false`; no `DEV_BEARER_TOKEN`.
Never post secret values or verification codes in GitHub, support tickets,
screenshots, or chat.

## Phase A — database and staging

- [ ] Supabase status is `ACTIVE_HEALTHY`.
- [ ] Eight expected public tables and three RPC functions exist.
- [ ] RLS enabled on all eight tables; service_role permissions only.
- [ ] Supabase security advisors have no high-severity blockers.
- [ ] Render service is deployed on the intended branch/head SHA.
- [ ] `GET /health` returns an HTTP 200 (code liveness only).
- [ ] Required environment values are present in encrypted Render settings.
- [ ] Application logs show no `CONFIG WARNING` or Supabase connection errors.

**Important:** Current code's `/health` is only a liveness check, not
evidence of credentials, database access, WhatsApp registration, or OAuth success.

## Phase B — OAuth

- [ ] In Supabase Auth > OAuth Server: enable OAuth 2.1.
- [ ] Configure Site URL to the staging HTTPS origin and authorization path
      `/oauth/consent`.
- [ ] If supported client requires it, enable dynamic registration; only
      connect clients you trust and periodically revoke unused grants.
- [ ] Confirm asymmetric RS256/ES256 JWT signing.
- [ ] Confirm a single owner account and allow-list.
- [ ] Confirm `/mcp` private tools reject missing/invalid bearer tokens.
- [ ] Confirm legitimate owner OAuth consent issues a token accepted by
      `tools/call`.
- [ ] Verify refresh token / offline access behavior for the chosen client.

## Phase C — Meta onboarding

- [ ] Confirm the phone uses an eligible WhatsApp Business App account.
- [ ] Complete Meta Embedded Signup and Coexistence without destructive
      migration of an ordinary personal WhatsApp account.
- [ ] Add the required Meta app permissions and webhooks.
- [ ] Register `/webhooks/whatsapp` as webhook callback; verify challenge
      using a token stored only in Render/Meta.
- [ ] Subscribe to WhatsApp `messages` events as documented for the account.
- [ ] Store Meta app secret, long-lived access token and phone-number ID in
      Render encrypted configuration.

## Phase D — real end-to-end test

Use a consenting test sender, not an existing private conversation.

- [ ] Sender sends a text containing a unique test phrase.
- [ ] Meta webhook POST passes signature verification.
- [ ] `messages` row is created once, with correct conversation/direction.
- [ ] Priority/fallback classification is persisted.
- [ ] An authenticated owner MCP `search_whatsapp` retrieves the phrase.
- [ ] MCP `get_conversation` returns the expected conversation.
- [ ] Negative test: unauthenticated `tools/call` is denied.
- [ ] Negative test: bad signature is rejected.
- [ ] Check sender consent, retention policy, and deletion workflow.

Only after those tests, consider outbound drafting and send tests. Sending
must remain explicitly approval-gated and respect WhatsApp's 24-hour
customer service window; avoid real recipients during initial verification.

## Known reliability concerns before GA

- Current webhook returns HTTP 200 before durable persistence finishes. If
  the process dies after acknowledgment, Meta may not retry and an event
  could be lost. Add a durable inbox/queue with retries before production.
- `/health` does not check readiness or database connectivity.
- Concurrent or retried `send_approved_reply` invocations need an atomic
  claim/idempotency guard to prevent duplicate outbound messages.
- Review private-message processing, retention, audit logs, consent and
  applicable GDPR requirements.

Do not merge PR #1 or claim go-live until the blocking tests pass.
