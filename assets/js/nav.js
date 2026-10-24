// Pedyo — Navigation auth state, view mode, unread badge, realtime
import { supabase } from './supabase-client.js';
import { escapeHtml, renderAvatar, initNavToggle } from './ui.js';
import { signOut } from './auth.js';
import { showNotification } from './notify.js';
import { icon } from './icons.js';
import { mountAssistant } from './assistant.js';
import {
  getIdentity, peekIdentity, setMode, setActiveListing, inboxPath, unreadMessages
} from './identity.js';

// The shell re-paints itself on a mode switch, so it keeps its own state.
let shell = null;   // { user, identity, actionsEl }

export async function initNav() {
  initNavToggle();
  // One mount point for the concierge rather than 38 pages of markup.
  mountAssistant();

  const actionsEl = document.getElementById('nav-actions');
  if (!actionsEl) return;

  // Paint from the last known identity first, so switching pages in provider
  // mode does not flash the personal shell while the listings query runs.
  const cached = localStorage.getItem('pedyo_user');
  if (cached) {
    try {
      const user = JSON.parse(cached);
      const identity = peekIdentity(user.id);
      if (identity) paintShell({ user, identity, actionsEl });
      else renderLoggedOut(actionsEl);
    } catch {
      renderLoggedOut(actionsEl);
    }
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
      const identity = await getIdentity(session.user.id);
      paintShell({ user: session.user, identity, actionsEl });
      await refreshUnreadBadge();
      subscribeUnread(session.user.id);
    } else {
      localStorage.removeItem('pedyo_user');
      renderLoggedOut(actionsEl);
    }
  } catch (e) {
    console.error('Nav auth check error:', e);
  }
}

function paintShell(state) {
  shell = state;
  const { user, identity, actionsEl } = state;
  // A cached provider mode whose listing has since been deleted must not render
  // a business shell with no business. Boolean, so template interpolation of
  // aria-pressed and the active classes stays honest.
  const provider = identity.mode === 'provider' && !!identity.listing;
  // Browsing as a listing paints that listing's own logo. The personal bubble
  // stays on initials: the listings this shell is built from are already here,
  // while a face would cost a profiles read on every page of the site.
  const bubble = renderAvatar(
    provider
      ? { avatar_url: identity.listing.avatar_url, full_name: identity.listing.business_name }
      : { full_name: user.email },
    'sm'
  );

  actionsEl.innerHTML = `
    ${provider ? `<span class="nav-mode-flag" title="Browsing as ${escapeHtml(identity.listing.business_name)} — switch back in the account menu">
      ${icon('building-2', { size: 12 })}<span>${escapeHtml(identity.listing.business_name)}</span>
    </span>` : ''}
    <a href="${inboxPath(identity.inbox)}" class="btn btn-ghost btn-sm" style="position:relative"
       aria-label="${provider ? 'Provider inbox' : 'Messages'}">
      ${icon('message-circle', { size: 18 })}
      <span id="nav-unread" class="nav-unread hidden">0</span>
    </a>
    <div style="position:relative">
      <button class="nav-avatar-btn" id="nav-avatar-btn" aria-label="Account menu" aria-haspopup="true"
              aria-controls="nav-dropdown" aria-expanded="false">
        ${bubble}
        ${icon('chevron-down', { size: 14 })}
      </button>
      <div class="nav-dropdown hidden" id="nav-dropdown">
        <div style="padding:12px 16px 8px;border-bottom:1px solid var(--color-border);margin-bottom:4px">
          <div style="font-size:12px;color:var(--color-text-muted)">${provider ? 'Browsing as' : 'Signed in as'}</div>
          <div style="font-size:13px;font-weight:600;color:var(--color-text);overflow:hidden;text-overflow:ellipsis">${escapeHtml(provider ? identity.listing.business_name : user.email)}</div>
          ${provider ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">${escapeHtml(user.email)}</div>` : ''}
        </div>
        ${modeSwitch(identity, provider)}
        <div class="nav-dropdown-divider"></div>
        ${provider ? providerRows(identity) : personalRows()}
        <a href="/settings.html" class="nav-dropdown-item">
          ${icon('settings', { size: 16 })}
          Settings
        </a>
        <div class="nav-dropdown-divider"></div>
        <button class="nav-dropdown-item danger" id="nav-signout">
          ${icon('log-out', { size: 16 })}
          Sign out
        </button>
      </div>
    </div>
  `;

  const avatarBtn = document.getElementById('nav-avatar-btn');
  const menu = document.getElementById('nav-dropdown');
  const setExpanded = (open) => avatarBtn?.setAttribute('aria-expanded', String(open));
  avatarBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!menu) return;
    setExpanded(!menu.classList.toggle('hidden'));
  });
  document.addEventListener('click', () => {
    menu?.classList.add('hidden');
    setExpanded(false);
  });

  document.getElementById('nav-signout')?.addEventListener('click', () => signOut());
  document.querySelectorAll('#nav-dropdown [data-mode]').forEach(btn =>
    btn.addEventListener('click', () => switchMode(btn.dataset.mode)));
  document.querySelectorAll('#nav-dropdown [data-listing]').forEach(btn =>
    btn.addEventListener('click', () => switchListing(btn.dataset.listing)));
}

function modeSwitch(identity, provider) {
  const hasListings = identity.listings.length > 0;
  return `
    <div class="nav-mode-switch" role="group" aria-label="Browse as">
      <button class="nav-mode-btn ${provider ? '' : 'active'}" data-mode="personal" aria-pressed="${!provider}">
        ${icon('user', { size: 14 })} Personal
      </button>
      <button class="nav-mode-btn ${provider ? 'active' : ''}" data-mode="provider" aria-pressed="${provider}"
              ${hasListings ? '' : 'disabled'} title="${hasListings ? 'Browse as your provider profile' : 'List a service to browse as a provider'}">
        ${icon('building-2', { size: 14 })} Provider
      </button>
    </div>
    ${provider && identity.listings.length > 1 ? identity.listings.map(l => `
      <button class="nav-dropdown-item" data-listing="${l.id}">
        ${icon('briefcase', { size: 16 })}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap${l.id === identity.listing.id ? ';font-weight:700' : ''}">${escapeHtml(l.business_name)}</span>
      </button>`).join('') : ''}
    ${hasListings ? '' : `
      <a href="/account/become-provider.html" class="nav-dropdown-item">
        ${icon('plus', { size: 16 })}
        List your services
      </a>`}`;
}

function personalRows() {
  return `
    <a href="/account/profile.html" class="nav-dropdown-item">
      ${icon('user', { size: 16 })}
      My Profile
    </a>
    <a href="/messages.html" class="nav-dropdown-item">
      ${icon('message-circle', { size: 16 })}
      Messages
    </a>
    <a href="/providers.html" class="nav-dropdown-item">
      ${icon('building-2', { size: 16 })}
      My Provider Profiles
    </a>`;
}

function providerRows(identity) {
  const l = identity.listing;
  return `
    <a href="/provider-messages.html" class="nav-dropdown-item">
      ${icon('inbox', { size: 16 })}
      Provider Inbox
    </a>
    <a href="/providers.html" class="nav-dropdown-item">
      ${icon('briefcase', { size: 16 })}
      Manage Listings
    </a>
    <a href="/provider.html?slug=${encodeURIComponent(l.slug)}" class="nav-dropdown-item">
      ${icon('external-link', { size: 16 })}
      View Public Listing
    </a>
    <a href="/verification.html" class="nav-dropdown-item">
      ${icon('shield-check', { size: 16 })}
      Verification
    </a>`;
}

async function switchMode(mode) {
  setMode(mode);
  // Comparing against the resolved mode rather than the stored one also
  // covers a stale 'provider' flag left behind by a deleted listing.
  if (shell.identity.mode === mode) return;
  // The mode changes the links as well as the account area, so the honest
  // repaint is a fresh document — except in an inbox, where the target page
  // is the switch. The thread id is dropped: it belongs to the other side.
  if (isInboxPage()) location.href = inboxPath(mode);
  else location.reload();
}

// Same mode, different business: the links do not move, so only the account
// area and the flag need re-painting.
async function switchListing(id) {
  if (shell.identity.listing?.id === id) return;
  setActiveListing(id);
  const identity = await getIdentity(shell.user.id);
  paintShell({ ...shell, identity });
  await refreshUnreadBadge();
}

function isInboxPage() {
  return ['/messages.html', '/provider-messages.html'].includes(location.pathname);
}

export async function refreshUnreadBadge() {
  if (!shell) return;
  const count = await unreadMessages(shell.user.id, shell.identity.inbox);
  const badge = document.getElementById('nav-unread');
  if (badge) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('hidden', count === 0);
  }
  const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
  document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base;
}

function renderLoggedOut(el) {
  shell = null;
  el.innerHTML = `
    <a href="/account/login.html" class="btn btn-ghost btn-sm">Sign in</a>
    <a href="/account/register.html" class="btn btn-primary btn-sm">Join free</a>
  `;
}

// Something landed is signalled by the trigger-written notifications row; which
// inbox it belongs to is read back from the membership rows, never assumed.
function subscribeUnread(userId) {
  supabase
    .channel('nav-notifications')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      if (payload.eventType === 'INSERT' && payload.record) {
        const rec = payload.record;
        const convId = rec.data?.conversation_id;
        showNotification(
          rec.title || 'Pedyo notification',
          rec.body || '',
          rec.type === 'message' && convId ? `${inboxPath()}?conv=${encodeURIComponent(convId)}` : null
        );
      }
      refreshUnreadBadge();
    })
    .subscribe();
}
