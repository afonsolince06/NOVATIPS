import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-';
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let password = '';

  while (password.length < 24) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    for (const byte of bytes) {
      if (byte < limit) password += alphabet[byte % alphabet.length];
      if (password.length === 24) break;
    }
  }

  return password;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Missing Supabase Edge Function environment configuration.');
    return jsonResponse({ error: 'Password reset is temporarily unavailable.' }, 500);
  }

  const token = authorization.slice('Bearer '.length);
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const caller = userData.user;
  if (userError || !caller?.email) return jsonResponse({ error: 'Authentication required.' }, 401);

  const callerEmail = caller.email.trim().toLowerCase();
  const { data: adminEntry, error: adminLookupError } = await adminClient
    .from('freshers_weekend_access')
    .select('email')
    .eq('email', callerEmail)
    .eq('is_admin', true)
    .maybeSingle();
  if (adminLookupError) {
    console.error('Could not verify administrator role:', adminLookupError.message);
    return jsonResponse({ error: 'Could not verify administrator access.' }, 500);
  }
  if (!adminEntry) return jsonResponse({ error: 'Administrator access required.' }, 403);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const targetEmail = typeof requestBody === 'object' && requestBody !== null && 'email' in requestBody
    ? String(requestBody.email).trim().toLowerCase()
    : '';
  if (!targetEmail || !/^[^\s@]+@novaims\.unl\.pt$/.test(targetEmail)) {
    return jsonResponse({ error: 'Enter a valid NOVA IMS email address.' }, 400);
  }

  const { data: targetEntry, error: targetLookupError } = await adminClient
    .from('freshers_weekend_access')
    .select('email')
    .eq('email', targetEmail)
    .maybeSingle();
  if (targetLookupError) {
    console.error('Could not verify target access:', targetLookupError.message);
    return jsonResponse({ error: 'Could not verify the target account.' }, 500);
  }
  if (!targetEntry) return jsonResponse({ error: 'That email is not on the event access list.' }, 404);

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email')
    .eq('email', targetEmail)
    .maybeSingle();
  if (profileError) {
    console.error('Could not look up target profile:', profileError.message);
    return jsonResponse({ error: 'Could not find the target account.' }, 500);
  }
  if (!profile) return jsonResponse({ error: 'That participant has not created an account yet.' }, 404);
  if (profile.id === caller.id) return jsonResponse({ error: 'Use your own profile to change your password.' }, 400);

  const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(profile.id);
  if (targetAuthError || !targetAuth.user) {
    console.error('Could not load target auth metadata:', targetAuthError?.message);
    return jsonResponse({ error: 'Could not load the target account.' }, 500);
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.id, {
    password: temporaryPassword,
    user_metadata: {
      ...targetAuth.user.user_metadata,
      force_password_change: true,
    },
  });
  if (updateError) {
    console.error('Could not reset target password:', updateError.message);
    return jsonResponse({ error: 'Could not reset the password. No changes were made.' }, 500);
  }

  const { error: sessionRevokeError } = await adminClient.rpc('admin_revoke_user_sessions', {
    p_user_id: profile.id,
  });
  if (sessionRevokeError) console.error('Could not revoke target sessions:', sessionRevokeError.message);

  const { error: auditError } = await adminClient.from('admin_password_reset_audit').insert({
    admin_user_id: caller.id,
    target_user_id: profile.id,
    sessions_revoked: !sessionRevokeError,
  });
  if (auditError) console.error('Password reset audit insert failed:', auditError.message);

  return jsonResponse({ temporaryPassword, sessionsRevoked: !sessionRevokeError });
});