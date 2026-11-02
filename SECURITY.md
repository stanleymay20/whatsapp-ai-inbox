# Security model

This service handles private communications. Treat the database and all credentials as sensitive.

## Enforced in code

- Meta webhook HMAC is verified before JSON parsing.
- Supabase service-role credentials remain server-side.
- Database RLS is enabled with no browser policies.
- MCP private tools require OAuth scopes unless explicitly put in an insecure local-development mode.
- OAuth JWTs are checked for RS256 signature, issuer, audience, expiration and scope.
- WhatsApp messages are treated as untrusted data in AI prompts to reduce prompt-injection risk.
- AI cannot send from the draft tool.
- Sending requires a stored approved draft plus a one-time confirmation code.
- Free-form sending is blocked outside the 24-hour inbound service window.
- Event callback URLs must use HTTPS and obvious local/private destinations are rejected.
- MCP event callbacks are challenge-verified and signed.
- Audit records are written for important state changes.

## Before production

1. Use an established OAuth 2.1 provider such as Auth0; do not expose `/mcp` anonymously.
2. Keep `ALLOW_INSECURE_NOAUTH=false` and remove any development bearer token.
3. Use a dedicated Supabase project or schema and configure backups/retention.
4. Add a WAF/rate limiter in front of `/mcp` and the Meta webhook.
5. Use an outbound egress proxy/firewall for MCP event delivery to eliminate DNS-rebinding TOCTOU risk.
6. Redact phone numbers/message content from infrastructure logs where possible.
7. Decide retention/deletion rules before importing historical WhatsApp content.
8. Complete a GDPR/privacy review before processing other people's private messages at scale.
9. Rotate Meta, Supabase, OpenAI and OAuth secrets after suspected disclosure.
10. Verify Coexistence history/echo payloads against the live Meta account before claiming complete history synchronization.

## Secrets never to paste into ChatGPT

- Meta access token
- Meta app secret
- WhatsApp verification PIN / one-time codes
- Supabase service-role key
- OpenAI API key
- OAuth client secret / private keys

Place them only in the deployment platform's encrypted secret store.
