import { config } from './config.mjs';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3';

export function oauthConsentHtml(nonce = '') {
  const supabaseUrl = JSON.stringify(config.supabaseUrl);
  const publishableKey = JSON.stringify(config.supabasePublishableKey);
  const scriptNonce = String(nonce).replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Authorize WhatsApp AI Inbox</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f8fafc}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 16px 50px rgba(15,23,42,.08);padding:28px;box-sizing:border-box}h1{font-size:24px;margin:0 0 10px}p{line-height:1.5;color:#475569}.row{display:grid;gap:12px}.field{display:grid;gap:6px}label{font-size:14px;font-weight:600}input{font:inherit;padding:12px;border:1px solid #cbd5e1;border-radius:10px}button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:12px 16px;cursor:pointer}.primary{background:#111827;color:#fff}.secondary{background:#e2e8f0;color:#111827}.danger{background:#fee2e2;color:#991b1b}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.muted{font-size:13px;color:#64748b}.error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:10px;border-radius:10px;margin:12px 0}.success{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;padding:10px;border-radius:10px;margin:12px 0}.details{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-top:14px}.hidden{display:none}code{word-break:break-all}</style>
</head>
<body>
<main class="card">
  <h1>WhatsApp AI Inbox</h1>
  <p>Authorize ChatGPT to access your private WhatsApp inbox connector. Approval here authenticates the owner; sending a WhatsApp reply still requires the separate draft → approve → <strong>SEND code</strong> workflow.</p>
  <div id="notice" class="hidden"></div>
  <section id="login" class="hidden">
    <h2>Owner sign in</h2>
    <p class="muted">Public sign-up is disabled on this page. Use the owner account created in Supabase Auth.</p>
    <form id="loginForm" class="row">
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="primary" type="submit">Sign in</button>
    </form>
  </section>
  <section id="consent" class="hidden">
    <h2>Approve access?</h2>
    <div class="details">
      <p><strong>Signed in as:</strong> <span id="signedInAs"></span></p>
      <p><strong>Client:</strong> <span id="clientName"></span></p>
      <p><strong>Redirect URI:</strong> <code id="redirectUri"></code></p>
      <p><strong>Requested permissions:</strong> <span id="scope"></span></p>
    </div>
    <div class="actions">
      <button id="approve" class="primary" type="button">Approve</button>
      <button id="deny" class="danger" type="button">Deny</button>
      <button id="signOut" class="secondary" type="button">Sign out</button>
    </div>
  </section>
</main>
<script src="${SDK_URL}"></script>
<script nonce="${scriptNonce}">
const SUPABASE_URL=${supabaseUrl};
const SUPABASE_KEY=${publishableKey};
const notice=document.getElementById('notice');
const login=document.getElementById('login');
const consent=document.getElementById('consent');
const authorizationId=new URLSearchParams(location.search).get('authorization_id');
function showNotice(message,type='error'){notice.textContent=message;notice.className=type;}
function clearNotice(){notice.textContent='';notice.className='hidden';}
function fail(message){showNotice(message,'error');login.classList.add('hidden');consent.classList.add('hidden');}
if(!SUPABASE_URL||!SUPABASE_KEY){fail('OAuth UI is not configured yet.');}
else if(!authorizationId){fail('Missing authorization_id. Start the connection from the OAuth client.');}
else if(!window.supabase){fail('Authentication library failed to load.');}
else init();
async function init(){
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  await refresh(client);
  document.getElementById('loginForm').addEventListener('submit',async(e)=>{e.preventDefault();clearNotice();const email=e.target.email.value.trim();const password=e.target.password.value;const {error}=await client.auth.signInWithPassword({email,password});if(error)return showNotice(error.message);e.target.password.value='';await refresh(client);});
  document.getElementById('approve').addEventListener('click',()=>decide(client,true));
  document.getElementById('deny').addEventListener('click',()=>decide(client,false));
  document.getElementById('signOut').addEventListener('click',async()=>{await client.auth.signOut();location.reload();});
}
async function refresh(client){
  clearNotice();
  const {data:{user},error:userError}=await client.auth.getUser();
  if(userError||!user){login.classList.remove('hidden');consent.classList.add('hidden');return;}
  login.classList.add('hidden');
  const {data,error}=await client.auth.oauth.getAuthorizationDetails(authorizationId);
  if(error||!data)return fail(error?.message||'Invalid authorization request.');
  if(!('authorization_id' in data)&&data.redirect_url){location.replace(data.redirect_url);return;}
  document.getElementById('signedInAs').textContent=user.email||user.id;
  document.getElementById('clientName').textContent=data.client?.name||data.client?.client_name||'OAuth client';
  document.getElementById('redirectUri').textContent=data.redirect_uri||'';
  document.getElementById('scope').textContent=data.scope||'email';
  consent.classList.remove('hidden');
}
async function decide(client,approve){
  clearNotice();
  document.getElementById('approve').disabled=true;document.getElementById('deny').disabled=true;
  const result=approve?await client.auth.oauth.approveAuthorization(authorizationId):await client.auth.oauth.denyAuthorization(authorizationId);
  if(result.error){showNotice(result.error.message);document.getElementById('approve').disabled=false;document.getElementById('deny').disabled=false;return;}
  if(result.data?.redirect_url){location.assign(result.data.redirect_url);return;}
  showNotice('Authorization response did not include a redirect URL.');
}
</script>
</body>
</html>`;
}
