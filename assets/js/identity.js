// Pedyo — personal vs provider view mode
//
// One account can hold several provider listings. The two sides of a thread are
// separate membership rows (conversation_members.inbox_type), so "which messages
// am I looking at" is a property of the shell, not of the conversation. The mode
// lives here so the nav, the badge and the inbox pages agree.
import { supabase } from './supabase-client.js';
import { icon } from './icons.js';

const MODE_KEY     = 'pedyo_view_mode';
const LISTING_KEY  = 'pedyo_active_listing';
const IDENTITY_KEY = 'pedyo_identity_';

export function getMode() {
  return localStorage.getItem(MODE_KEY) === 'provider' ? 'provider' : 'personal';
}

export function setMode(mode) {
  localStorage.setItem(MODE_KEY, mode === 'provider' ? 'provider' : 'personal');
}

export function inboxPath(mode = getMode()) {
  return mode === 'provider' ? '/provider-messages.html' : '/messages.html';
}

// The tab strip used by both inboxes. Showing each side's unread count next to
// it is what makes "your messages are on the other tab" visible instead of
// looking like lost mail.
export function modeSwitchHtml(active, counts = {}) {
  const pill = (key, href, label, name) => `
    <a href="${href}" class="nav-mode-btn ${active === key ? 'active' : ''}"${active === key ? ' aria-current="page"' : ''}>
      ${icon(name, { size: 14 })} ${label}
      ${counts[key] > 0 ? `<span class="unread-dot">${counts[key] > 99 ? '99+' : counts[key]}</span>` : ''}
    </a>`;
  return `<div class="nav-mode-switch plain">
    ${pill('personal', '/messages.html', 'Personal', 'user')}
    ${pill('provider', '/provider-messages.html', 'Provider', 'building-2')}
  </div>`;
}

let cache = null;

export async function getMyListings(userId, force = false) {
  if (!force && cache?.userId === userId) return cache.listings;
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('id, business_name, slug, status, provider_type, avatar_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  const listings = error ? [] : (data || []);
  cache = { userId, listings };
  return listings;
}

export function setActiveListing(id) {
  localStorage.setItem(LISTING_KEY, id);
}

// Synchronous read for the nav template, which is rendered before any query
// resolves. Returns the listing the shell is acting as, or null when the
// visitor is browsing personally (or is signed out).
export function viewingAsProvider() {
  if (getMode() !== 'provider') return null;
  try {
    const user = JSON.parse(localStorage.getItem('pedyo_user') || 'null');
    if (!user?.id) return null;
    const identity = peekIdentity(user.id);
    return identity?.mode === 'provider' ? identity.listing : null;
  } catch {
    return null;
  }
}

// Resolved view state for the shell. Falls back to personal whenever there is
// nothing to view as, so a stale localStorage value can never show an empty
// provider inbox to someone who has no listing.
export async function getIdentity(userId) {
  const listings = await getMyListings(userId);
  const wanted = localStorage.getItem(LISTING_KEY);
  const listing = listings.find(l => l.id === wanted) || listings[0] || null;
  const mode = getMode() === 'provider' && listing ? 'provider' : 'personal';
  const identity = { mode, listing, listings, inbox: mode };
  rememberIdentity(userId, identity);
  return identity;
}

// Last resolved identity, kept so the nav and the nav links can paint the
// right shell before the listings query comes back — including in a fresh tab,
// which is why this is localStorage and not sessionStorage. The mode is
// re-resolved from getMode() rather than trusted from the cache: inbox pages
// pin the mode before initNav() runs and the first paint must agree with them.
export function peekIdentity(userId) {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY + userId);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const listings = cached.listings || [];
    const listing = listings.find(l => l.id === cached.listing?.id) || listings[0] || null;
    const mode = getMode() === 'provider' && listing ? 'provider' : 'personal';
    return { ...cached, mode, inbox: mode, listing };
  } catch { return null; }
}

function rememberIdentity(userId, identity) {
  try {
    localStorage.setItem(IDENTITY_KEY + userId, JSON.stringify(identity));
  } catch {}
}

// The next person to sign in must not inherit this one's business shell.
export function clearIdentity() {
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(LISTING_KEY);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(IDENTITY_KEY)) localStorage.removeItem(key);
  }
}

// Unread for the inbox being viewed. Read from the membership rows rather than
// the notifications table: opening a thread zeroes the counter immediately, and
// only these rows know which side of the thread the unread belongs to.
export async function unreadMessages(userId, inbox) {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('unread_count')
    .eq('user_id', userId)
    .eq('inbox_type', inbox);
  if (error) return 0;
  return (data || []).reduce((sum, m) => sum + (m.unread_count || 0), 0);
}

export async function inboxCounts(userId) {
  const [personal, provider] = await Promise.all([
    unreadMessages(userId, 'personal'),
    unreadMessages(userId, 'provider')
  ]);
  return { personal, provider };
}
