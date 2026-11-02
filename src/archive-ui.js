(async function () {
  'use strict';
  const status = document.getElementById('status');
  const login = document.getElementById('login');
  const archive = document.getElementById('archive');
  const input = document.getElementById('file');
  const consent = document.getElementById('consent');
  const upload = document.getElementById('upload');
  const preview = document.getElementById('preview');
  const say = msg => { status.textContent = msg; };
  let cfg;
  try {
    const r = await fetch('/archive/config', { cache:'no-store' });
    cfg = await r.json();
    if (!r.ok || !cfg.supabase_url || !cfg.supabase_publishable_key || !window.supabase) {
      throw new Error('Archive sign-in is not configured.');
    }
  } catch { say('Archive sign-in is not configured.'); return; }
  const client = window.supabase.createClient(cfg.supabase_url,cfg.supabase_publishable_key,
    { auth:{ persistSession:true } });
  const refresh = async () => {
    const {data:{user},error} = await client.auth.getUser();
    login.classList.toggle('hidden',Boolean(user)&&!error);
    archive.classList.toggle('hidden',!user||Boolean(error));
    if (user) document.getElementById('user').textContent = 'Signed in as ' + (user.email || 'owner');
  };
  document.getElementById('loginForm').addEventListener('submit',async ev => {
    ev.preventDefault();
    const email = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password');
    const {error} = await client.auth.signInWithPassword({email,password:passwordInput.value});
    passwordInput.value = '';
    if (error) { say('Sign in failed: ' + error.message); return; }
    say('Signed in. Select a chat export.');
    await refresh();
  });
  document.getElementById('logout').addEventListener('click',async () => {
    await client.auth.signOut(); await refresh(); say('Signed out.');
  });
  const update = () => {
    const f = input.files?.[0];
    const valid = f && /\.txt$/i.test(f.name) && f.size > 0 && f.size <= 1500000;
    preview.textContent = f
      ? ('File: ' + f.name + '\nSize: ' + f.size + ' bytes\nYour data uploads only after confirmation.')
      : 'No file selected.';
    upload.disabled = !(valid && consent.checked);
    if (f && !valid) say('Please select a .txt export under 1.5 MB.');
  };
  input.addEventListener('change',update);
  consent.addEventListener('change',update);
  upload.addEventListener('click',async () => {
    const f=input.files?.[0];
    if (!f || upload.disabled || !consent.checked) return;
    upload.disabled = true;
    try {
      const {data:{session}} = await client.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in again.');
      const sourceText = await f.text();
      if (new TextEncoder().encode(sourceText).length > 1500000) throw new Error('File too large.');
      say('Importing selected chat...');
      const r = await fetch('/archive/import',{
        method:'POST',
        headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},
        body:JSON.stringify({filename:f.name,source_text:sourceText})
      });
      const data=await r.json();
      if (!r.ok) throw new Error(data.error || 'Import failed.');
      say((data.duplicate ? 'Already imported: ' : 'Imported: ')+data.entry_count+' entries.\n'
        +'Archive ID: '+data.import_id+'\nSHA-256: '+data.source_sha256);
    } catch(e) { say('Import failed: '+e.message); }
    finally { consent.checked=false; update(); }
  });
  refresh().catch(() => say('Owner authentication unavailable.'));
})();
