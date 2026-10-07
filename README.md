# WhatsApp AI Inbox — v0.2

A production-oriented WhatsApp Business → ChatGPT bridge built around the official Meta WhatsApp Business Platform, Supabase/Postgres, the OpenAI Responses API, and MCP.

The goal is simple: make WhatsApp behave more like a searchable, priority-aware inbox so important opportunities, deadlines, unanswered messages, and follow-ups are harder to miss.

## What this build includes

- Meta webhook verification (`hub.challenge`)
- `X-Hub-Signature-256` HMAC validation before payload parsing
- inbound WhatsApp message ingestion
- delivery/read status ingestion
- best-effort WhatsApp Business App Coexistence echo/history handling
- Supabase/Postgres persistence with RLS enabled
- full-text WhatsApp search RPC
- priority/opportunity classification through OpenAI Responses API
- unanswered-message detection
- conversation retrieval and summarization
- AI reply drafting
- explicit approval + second-step `SEND <code>` confirmation before sending
- 24-hour free-form WhatsApp service-window enforcement
- OAuth-protected MCP tools
- MCP event subscriptions for important-message alerts
- audit logging

## Architecture

```text
WhatsApp Business App / Cloud API
            |
            v
      Meta signed webhook
            |
            v
   whatsapp-ai-inbox service
      |        |        |
      |        |        +--> OpenAI Responses API
      |        +-----------> Supabase/Postgres
      +--------------------> MCP tools/events --> ChatGPT Work
```

## Safety model

The application is approval-first. `create_reply_draft` never sends. `approve_reply` still does not send; it generates a short confirmation code. Only `send_approved_reply` can send, and it requires the matching code supplied after explicit user confirmation.

The connector also blocks ordinary free-form replies when the 24-hour WhatsApp customer-service window is closed.

Never commit real tokens, Meta secrets, Supabase service-role keys, OpenAI keys, OAuth secrets, PINs, or verification codes.

## Local verification

Requires Node.js 22+.

```bash
npm run check
npm test
npm start
```

No third-party npm runtime packages are required in v0.2.

## Environment

Copy values from `.env.example` into the encrypted secret store of the deployment platform.

Core:

```text
PUBLIC_BASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

WhatsApp:

```text
META_GRAPH_VERSION=v26.0
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_PHONE_E164
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
META_APP_SECRET
```

OpenAI:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

MCP OAuth:

```text
OAUTH_ISSUER
OAUTH_AUDIENCE
OAUTH_JWKS_URI
OAUTH_REQUIRED_SCOPES=whatsapp.read whatsapp.write
```

Keep `ALLOW_INSECURE_NOAUTH=false` in production.

## Supabase setup

Run:

```text
supabase/migrations/001_init.sql
```

It creates:

- `contacts`
- `conversations`
- `messages`
- `message_priority`
- `conversation_summaries`
- `reply_drafts`
- `audit_log`
- `mcp_event_subscriptions`
- `search_whatsapp_messages(...)`
- `list_priority_messages(...)`
- `list_unanswered_messages(...)`

All tables have RLS enabled. This design assumes server-side use of the service role only; no browser-facing policies are created.

## Meta webhook

Use:

```text
https://YOUR_DOMAIN/webhooks/whatsapp
```

The service verifies Meta's GET challenge and validates every POST with the configured Meta app secret.

For an existing WhatsApp Business App number, prefer Meta Coexistence when the account is eligible. Do not destructively migrate or unregister the number before eligibility and the exact onboarding path are confirmed.

## MCP endpoint

```text
https://YOUR_DOMAIN/mcp
```

Implemented tools:

```text
get_profile
search_whatsapp
list_priority_messages
list_unanswered_messages
get_conversation
summarize_conversation
create_reply_draft
approve_reply
send_approved_reply
reject_reply
```

Implemented events:

```text
whatsapp.message_received
whatsapp.priority_detected
```

The priority event supports a `min_score` threshold so ordinary traffic does not generate alerts.

## Intended ChatGPT usage

Examples:

- “Check WhatsApp for important messages today.”
- “Did I miss any job, investor, grant, university, visa, payment, or business opportunity?”
- “Which WhatsApp conversations are waiting for my reply?”
- “Find the conversation about the interview next week.”
- “Summarize this thread and tell me the next action.”
- “Draft a reply.”

## Deployment target

`render.yaml` defines a Node web service with:

```text
buildCommand: npm run check && npm test
startCommand: npm start
healthCheckPath: /health
```

Deploy only after secrets are configured and the Supabase migration has been applied.

## Production gates still required

Before calling this live/GA:

1. verify the branch tests on the deployed commit;
2. apply the Supabase migration and read back the schema/RPCs;
3. configure OAuth and confirm `/mcp` is not anonymously accessible;
4. configure Meta Embedded Signup / Coexistence for the real WhatsApp Business account;
5. verify the exact Meta echo/history payloads received by that account;
6. complete a real inbound-message test;
7. complete an opportunity-classification test;
8. complete an approval-gated outbound reply test;
9. verify message delivery/read statuses;
10. perform a privacy/GDPR retention review before large-scale historical import.

See `SECURITY.md` for the security checklist.
