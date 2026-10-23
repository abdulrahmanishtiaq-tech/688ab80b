(function (root) {
  'use strict';
  root.DI = root.DI || {};
  const site = root.DI.site || {};
  const missing = [];
  if (!site.supabaseUrl) missing.push('DI.site.supabaseUrl');
  if (!site.supabaseAnonKey) missing.push('DI.site.supabaseAnonKey');
  if (!root.supabase || typeof root.supabase.createClient !== 'function') missing.push('Supabase client library');
  if (missing.length) {
    const message = `Order saving is unavailable because ${missing.join(', ')} is not configured.`;
    console.error(`[Digital Invitations] ${message}`);
    root.DI.supabaseError = message;
    return;
  }
  try {
    root.DI.supabase = root.supabase.createClient(site.supabaseUrl, site.supabaseAnonKey);
  } catch (error) {
    root.DI.supabaseError = 'Order saving is temporarily unavailable. Please try again later.';
    console.error('[Digital Invitations] Could not initialize Supabase', error);
  }
}(window));
