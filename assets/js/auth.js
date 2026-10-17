// Pedyo — Authentication, session management, push notification prompt
import { supabase } from './supabase-client.js';

export async function init() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (e) {
    console.error('Auth init error:', e);
    return null;
  }
}

export async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (e) {
    return null;
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, fullName) {
  // The profile row is created by the on_auth_user_created trigger,
  // which reads full_name out of this metadata. Writing the row from
  // the page instead is the race that used to lose the name: with
  // email confirmation enabled the client is still anon at that
  // moment, so RLS rejects the insert while the account is created.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || null },
      emailRedirectTo: `${window.location.origin}/account/confirm-email.html`
    }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('Sign out error:', e);
  } finally {
    localStorage.removeItem('pedyo_user');
    window.location.href = '/';
  }
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/account/reset-password.html`
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// localStorage is a render hint only (see nav.js) — it is not evidence
// of a session. Trusting it here let a stale key past the guard while
// the JWT had expired, so the page "loaded" and then failed every
// query with no redirect.
export async function isLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  return Boolean(session?.user);
}

export async function requireAuth(redirectTo) {
  if (await isLoggedIn()) return true;
  const target = redirectTo || window.location.pathname + window.location.search;
  window.location.href = `/account/login.html?next=${encodeURIComponent(target)}`;
  return false;
}

// Push notification prompt (shown once after login)
export async function promptPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  const shown = localStorage.getItem('pedyo_push_prompted');
  if (shown) return;
  localStorage.setItem('pedyo_push_prompted', '1');
  // Show gentle in-app prompt — actual permission request on user click
  const banner = document.createElement('div');
  banner.id = 'push-banner';
  banner.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:#17252A;color:#fff;padding:14px 20px;border-radius:12px;
    display:flex;align-items:center;gap:16px;z-index:9999;
    box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:14px;max-width:480px;width:90%;
  `;
  banner.innerHTML = `
    <span>🔔 Enable notifications to get new message alerts.</span>
    <button id="push-yes" style="background:#157A5A;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap;">Enable</button>
    <button id="push-no" style="background:transparent;color:#94A3B8;border:none;cursor:pointer;font-size:18px;line-height:1;">✕</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('push-yes').onclick = async () => {
    await Notification.requestPermission();
    banner.remove();
  };
  document.getElementById('push-no').onclick = () => banner.remove();
}

// Listen for auth state changes and sync localStorage
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    localStorage.setItem('pedyo_user', JSON.stringify({
      id: session.user.id,
      email: session.user.email
    }));
  } else {
    localStorage.removeItem('pedyo_user');
  }
});