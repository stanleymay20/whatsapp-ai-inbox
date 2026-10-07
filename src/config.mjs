function bool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  metaGraphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  businessPhone: process.env.WHATSAPP_BUSINESS_PHONE_E164 || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || '',
  oauthIssuer: (process.env.OAUTH_ISSUER || '').replace(/\/$/, ''),
  oauthAudience: process.env.OAUTH_AUDIENCE || '',
  oauthJwksUri: process.env.OAUTH_JWKS_URI || '',
  oauthScopes: (process.env.OAUTH_REQUIRED_SCOPES || 'email').split(/\s+/).filter(Boolean),
  oauthAllowedEmails: (process.env.OAUTH_ALLOWED_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
  devBearerToken: process.env.DEV_BEARER_TOKEN || '',
  allowInsecureNoAuth: bool('ALLOW_INSECURE_NOAUTH', false),
  priorityEventMinScore: Number(process.env.PRIORITY_EVENT_MIN_SCORE || 75),
  maxSearchResults: Number(process.env.MAX_SEARCH_RESULTS || 50),
};

export function assertCoreConfig() {
  const missing = [];
  for (const [name, value] of [
    ['PUBLIC_BASE_URL', config.publicBaseUrl],
    ['SUPABASE_URL', config.supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', config.supabaseServiceRoleKey],
  ]) if (!value) missing.push(name);
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(', ')}`);
}
