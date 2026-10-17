// Pedyo — Navigation auth state, unread badge, realtime
import { supabase } from './supabase-client.js';
import { escapeHtml, avatarInitials } from './ui.js';
import { signOut } from './auth.js';
import { initNavToggle } from './ui.js';

export async function initNav() {
  initNavToggle();

  const actionsEl = document.getElementById('nav-actions');
  if (!actionsEl) return;

  // Read from localStorage immediately (no flicker)
  const cached = localStorage.getItem('pedyo_user');
  if (cached) {
    try {
      const user = JSON.parse(cached);
      renderLoggedIn(actionsEl, user);
    } catch {}
  } else {
    renderLoggedOut(actionsEl);
  }

  // Confirm with Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      localStorage.setItem('pedyo_user', JSON.stringify({
        id: session.user.id,
        email: session.user.email
      }));
      renderLoggedIn(actionsEl, session.user);
      await loadUnreadCount(session.user.id);
      subscribeUnread(session.user.id);
    } else {
      localStorage.removeItem('pedyo_user');
      renderLoggedOut(actionsEl);
    }
  } catch (e) {
    console.error('Nav auth check error:', e);
  }
}

function renderLoggedOut(el) {
  el.innerHTML = `
    <a href="/account/login.html" class="btn btn-ghost btn-sm">Sign in</a>
    <a href="/account/register.html" class="btn btn-primary btn-sm">Join free</a>
  `;
}

function renderLoggedIn(el, user) {
  const initials = avatarInitials(user.email);
  el.innerHTML = `
    <a href="/messages.html" class="btn btn-ghost btn-sm" style="position:relative">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span id="nav-unread" class="nav-unread hidden">0</span>
    </a>
    <div style="position:relative">
      <button class="nav-avatar-btn" id="nav-avatar-btn" aria-label="Account menu">
        <div class="avatar" style="width:36px;height:36px;font-size:0.8rem">${escapeHtml(initials)}</div>
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="nav-dropdown hidden" id="nav-dropdown">
        <div style="padding:12px 16px 8px;border-bottom:1px solid var(--color-border);margin-bottom:4px">
          <div style="font-size:12px;color:var(--color-text-muted)">Signed in as</div>
          <div style="font-size:13px;font-weight:600;color:var(--color-text);overflow:hidden;text-overflow:ellipsis">${escapeHtml(user.email)}</div>
        </div>
        <a href="/account/profile.html" class="nav-dropdown-item">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          My Profile
        </a>
        <a href="/providers.html" class="nav-dropdown-item">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          My Provider Profiles
        </a>
        <a href="/messages.html" class="nav-dropdown-item">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Messages
        </a>
        <a href="/provider-messages.html" class="nav-dropdown-item">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Provider Inbox
        </a>
        <a href="/settings.html" class="nav-dropdown-item">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </a>
        <div class="nav-dropdown-divider"></div>
        <button class="nav-dropdown-item danger" id="nav-signout">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </div>
  `;

  // Dropdown toggle
  document.getElementById('nav-avatar-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('nav-dropdown')?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    document.getElementById('nav-dropdown')?.classList.add('hidden');
  });

  // Sign out
  document.getElementById('nav-signout')?.addEventListener('click', () => signOut());
}

async function loadUnreadCount(userId) {
  try {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    updateUnreadBadge(count || 0);
    // Update page title
    if (count > 0) {
      document.title = `(${count}) ${document.title.replace(/^\(\d+\) /, '')}`;
    }
  } catch (e) {
    console.error('Unread count error:', e);
  }
}

function updateUnreadBadge(count) {
  const badge = document.getElementById('nav-unread');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function subscribeUnread(userId) {
  supabase
    .channel('nav-notifications')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, () => loadUnreadCount(userId))
    .subscribe();
}