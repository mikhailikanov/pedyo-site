// Pedyo — Messaging, realtime, inbox separation
import { supabase } from './supabase-client.js';
import { escapeHtml, formatTime, avatarInitials } from './ui.js';

// The two people in a thread are both profiles rows, so conversations
// carries two foreign keys to profiles. PostgREST cannot guess which
// one an unqualified `profiles(...)` embed means, so each side is
// pinned to its constraint and aliased.
const INBOX_SELECT = `
  *,
  conversation_members!inner(user_id, inbox_type, unread_count),
  customer:profiles!conversations_customer_id_fkey(full_name, avatar_url),
  provider:profiles!conversations_provider_id_fkey(full_name, avatar_url),
  provider_profiles(business_name, slug, avatar_url),
  messages(content, created_at, sender_id)
`;

function shapeInboxRow(row, userId) {
  const iAmCustomer = row.customer_id === userId;
  const other = iAmCustomer ? row.provider : row.customer;
  // A customer's inbox is about the business they hired; the provider's
  // inbox is about the person who messaged them.
  const name = iAmCustomer
    ? (row.provider_profiles?.business_name || other?.full_name)
    : (other?.full_name || row.provider_profiles?.business_name);

  return {
    ...row,
    other_party_name: name || 'Pedyo user',
    // On the business side of a thread the listing leads; the owner's own
    // photo only backs it up, because whoever replies is still a person.
    other_party_avatar: (iAmCustomer ? row.provider_profiles?.avatar_url : null) || other?.avatar_url || null,
    unread_count: row.conversation_members?.[0]?.unread_count || 0
  };
}

async function fetchInbox(userId, inboxType) {
  try {
    // Filter on the member row, not conversations.inbox_type: one thread
    // is 'personal' to the customer and 'provider' to the provider at the
    // same time, so a thread-level column can only ever describe one of
    // them — which is why the old inbox listed nothing at all.
    const { data, error } = await supabase
      .from('conversations')
      .select(INBOX_SELECT)
      .eq('conversation_members.user_id', userId)
      .eq('conversation_members.inbox_type', inboxType)
      .order('updated_at', { ascending: false })
      .order('created_at', { foreignTable: 'messages', ascending: true });
    if (error) throw error;
    return (data || []).map(row => shapeInboxRow(row, userId));
  } catch (e) {
    console.error(`Get ${inboxType} conversations error:`, e);
    return [];
  }
}

// ── Personal inbox (customer-initiated) ──────────────────────────────────────
export async function getPersonalConversations(userId) {
  return fetchInbox(userId, 'personal');
}

// ── Provider inbox (messages from customers about a provider profile) ─────────
export async function getProviderConversations(userId) {
  return fetchInbox(userId, 'provider');
}

export async function getMessages(conversationId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Get messages error:', e);
    return [];
  }
}

export async function markThreadRead(conversationId) {
  const { error } = await supabase
    .rpc('mark_thread_read', { p_conversation_id: conversationId });
  if (error) console.error('Mark read error:', error);
}

export async function sendMessage(conversationId, senderId, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select()
    .single();
  if (error) throw error;
  // conversations.updated_at and the other side's unread counter are
  // both maintained by triggers on this insert.
  return data;
}

export async function startConversation(customerId, providerId, providerProfileId, initialMessage) {
  // Insert-don't-check: conversations is unique on
  // (customer_id, provider_profile_id), so a second click on "message"
  // resolves to the same thread instead of racing itself.
  const { error: insertError } = await supabase
    .from('conversations')
    .insert(
      { customer_id: customerId, provider_id: providerId, provider_profile_id: providerProfileId },
      { onConflict: 'customer_id,provider_profile_id', ignoreDuplicates: true }
    );
  if (insertError) throw insertError;

  const { data: conv, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', customerId)
    .eq('provider_profile_id', providerProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!conv) throw new Error('Could not open a conversation. Please try again.');

  const { error: memberError } = await supabase
    .from('conversation_members')
    .upsert(
      [
        { conversation_id: conv.id, user_id: customerId, inbox_type: 'personal' },
        { conversation_id: conv.id, user_id: providerId, inbox_type: 'provider' }
      ],
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
    );
  if (memberError) throw memberError;

  if (initialMessage) await sendMessage(conv.id, customerId, initialMessage);
  return conv.id;
}

export function subscribeToConversation(conversationId, onMessage) {
  return supabase
    .channel(`conv-${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => onMessage(payload.new))
    .subscribe();
}

export function renderConversationItem(conv, currentUserId, isActive = false, avatarClass = '') {
  const lastMsg = conv.messages?.[conv.messages.length - 1];
  const otherName = conv.other_party_name || 'Pedyo user';
  const unread = conv.unread_count > 0;
  const fallback = escapeHtml(avatarInitials(otherName));
  const cls = `avatar${avatarClass ? ' ' + avatarClass : ''}`;
  // The photo sits over the initials; if it fails to load it hides
  // itself and the initials underneath show through.
  const avatar = conv.other_party_avatar
    ? `<div class="${cls} avatar-stack">
         ${fallback}
         <img src="${escapeHtml(conv.other_party_avatar)}" alt=""
              onerror="this.style.display='none'">
       </div>`
    : `<div class="${cls}">${fallback}</div>`;

  return `
    <div class="conversation-item ${isActive ? 'active' : ''} ${unread ? 'unread' : ''}"
         data-conv-id="${escapeHtml(conv.id)}" role="button" tabindex="0">
      ${avatar}
      <div class="conv-info">
        <div class="conv-name">${escapeHtml(otherName)}</div>
        <div class="conv-preview">${lastMsg ? escapeHtml(lastMsg.content) : 'No messages yet'}</div>
      </div>
      <div class="conv-meta">
        <span class="conv-time">${lastMsg ? formatTime(lastMsg.created_at) : ''}</span>
        ${unread ? `<span class="unread-dot">${conv.unread_count}</span>` : ''}
      </div>
    </div>
  `;
}

export function renderMessage(msg, currentUserId) {
  const isSent = msg.sender_id === currentUserId;
  // Vulgar text is masked in the database, not here. The writer sees what
  // they wrote; the reader gets the mask and decides whether to look past
  // it. Both texts travel as data, never as markup.
  const reveal = !isSent && msg.censored;
  const text = isSent ? (msg.original_content || msg.content) : msg.content;
  return `
    <div class="msg-row ${isSent ? 'sent' : 'received'}">
      <div class="msg-bubble ${isSent ? 'sent' : 'received'}">
        <span class="msg-text">${escapeHtml(text)}</span>
        ${reveal ? `<button type="button" class="msg-unmask" data-shown="0"
              data-masked="${escapeHtml(msg.content)}"
              data-original="${escapeHtml(msg.original_content || '')}">Show message</button>` : ''}
      </div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>
  `;
}

// One delegated listener for every thread: messages arrive from the REST
// read, from realtime, and from the send echo, so per-node wiring would
// have to be repeated at each of those three call sites.
document.addEventListener('click', event => {
  const btn = event.target.closest('.msg-unmask');
  if (!btn) return;
  const shown = btn.dataset.shown === '1';
  const bubble = btn.closest('.msg-bubble');
  bubble.querySelector('.msg-text').textContent = shown ? btn.dataset.masked : btn.dataset.original;
  btn.dataset.shown = shown ? '0' : '1';
  btn.textContent = shown ? 'Show message' : 'Hide';
});