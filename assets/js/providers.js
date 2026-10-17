// Pedyo — Provider profile CRUD and rendering
import { supabase } from './supabase-client.js';
import { escapeHtml, formatDate, renderVerificationBadges, truncate, avatarInitials } from './ui.js';

export async function getProviderBySlug(slug) {
  try {
    const { data, error } = await supabase
      .from('provider_profiles')
      .select(`
        *,
        profiles(full_name, avatar_url),
        provider_services(*),
        service_areas(*),
        provider_images(*)
      `)
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Get provider error:', e);
    return null;
  }
}

// Ordering is applied here rather than in the page because the sort
// control existed but was never read by anything.
const SORTS = {
  newest:  [{ column: 'created_at', ascending: false }],
  name:    [{ column: 'business_name', ascending: true }],
  rating:  [{ column: 'rating_avg', ascending: false, nullsFirst: false },
            { column: 'review_count', ascending: false }]
};

export async function searchProviders({ query = '', category = '', type = '', verification = '', sort = 'newest', page = 1, limit = 12 } = {}) {
  try {
    // An inner join on the services embed, not a post-filter: the old
    // build paginated first and then dropped non-matching rows in JS,
    // so a matching provider on page 3 was unreachable from page 1.
    const useCategory = Boolean(category);

    let q = supabase
      .from('provider_profiles')
      .select(`
        *,
        profiles(full_name, avatar_url),
        provider_services${useCategory ? '!inner' : ''}(service_name, category),
        service_areas(area_name)
      `, { count: 'exact' })
      .eq('status', 'approved');

    if (useCategory) q = q.eq('provider_services.category', category);
    if (query) {
      // One predicate over the server-maintained search_text column,
      // which covers business name, description, services, categories
      // and coverage areas. Wildcards in the user's own text are
      // escaped so "100%" does not match every row.
      const like = `%${query.replace(/[%_]/g, '\\$&')}%`;
      q = q.ilike('search_text', like);
    }
    if (type) q = q.eq('provider_type', type);
    if (verification === 'verified') q = q.eq('identity_reviewed', true);

    for (const s of (SORTS[sort] || SORTS.newest)) {
      q = q.order(s.column, { ascending: s.ascending, nullsFirst: s.nullsFirst });
    }

    const from = (page - 1) * limit;
    q = q.range(from, from + limit - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    return { providers: data || [], total: count || 0 };
  } catch (e) {
    console.error('Search providers error:', e);
    return { providers: [], total: 0 };
  }
}

export async function getMyProviderProfiles(userId) {
  try {
    const { data, error } = await supabase
      .from('provider_profiles')
      .select('*, provider_services(*), service_areas(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Get my providers error:', e);
    return [];
  }
}

export async function createProviderProfile(userId, profileData) {
  const slug = generateSlug(profileData.business_name);
  const { data, error } = await supabase
    .from('provider_profiles')
    .insert({ ...profileData, user_id: userId, slug, status: 'draft' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProviderProfile(profileId, updates) {
  const { data, error } = await supabase
    .from('provider_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitForReview(profileId) {
  const { error } = await supabase
    .from('provider_profiles')
    .update({ status: 'pending' })
    .eq('id', profileId);
  if (error) throw error;
}

// ── Services ─────────────────────────────────────────────────────────────────
// Every seeded provider lists its services under its own
// primary_category, so a service inherits the profile's category rather
// than picking one per row. Category browse joins on this table, so a
// profile with no services here is undiscoverable.

export async function addServices(profileId, items, category) {
  const rows = normaliseServiceItems(items).map(s => ({
    provider_profile_id: profileId,
    service_name: s.service_name,
    price_note: s.price_note,
    description: null,
    category
  }));
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from('provider_services')
    .insert(rows)
    .select();
  if (error) throw error;
  return data || [];
}

// Replaces the set: rows removed in the editor are deleted, existing
// ones updated, and blanks inserted.
export async function saveProviderServices(profileId, items, category) {
  const clean = normaliseServiceItems(items);
  const existing = await listServices(profileId);

  const keepIds = new Set();
  const toInsert = [];
  for (const s of clean) {
    const match = existing.find(e => e.id === s.id);
    if (match) {
      keepIds.add(match.id);
      if (match.service_name !== s.service_name || (match.price_note || '') !== s.price_note) {
        const { error } = await supabase.from('provider_services')
          .update({ service_name: s.service_name, price_note: s.price_note })
          .eq('id', match.id);
        if (error) throw error;
      }
    } else {
      toInsert.push(s);
    }
  }

  const stale = existing.filter(e => !keepIds.has(e.id));
  if (stale.length) {
    const { error } = await supabase.from('provider_services')
      .delete().in('id', stale.map(s => s.id));
    if (error) throw error;
  }

  if (toInsert.length) await addServices(profileId, toInsert, category);
  return listServices(profileId);
}

export async function listServices(profileId) {
  const { data, error } = await supabase
    .from('provider_services')
    .select('id, service_name, price_note')
    .eq('provider_profile_id', profileId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveServiceAreas(profileId, names) {
  const clean = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))];
  const { data: existing, error } = await supabase
    .from('service_areas')
    .select('id, area_name')
    .eq('provider_profile_id', profileId);
  if (error) throw error;

  const keep = new Set(clean);
  const toDelete = (existing || []).filter(a => !keep.has(a.area_name));
  if (toDelete.length) {
    const { error: delError } = await supabase.from('service_areas')
      .delete().in('id', toDelete.map(a => a.id));
    if (delError) throw delError;
  }
  const known = new Set((existing || []).map(a => a.area_name));
  const toInsert = clean.filter(n => !known.has(n));
  if (toInsert.length) {
    const { error: insError } = await supabase.from('service_areas').insert(
      toInsert.map(area_name => ({ provider_profile_id: profileId, area_name })));
    if (insError) throw insError;
  }
}

function normaliseServiceItems(items) {
  return (items || [])
    .map(s => ({
      id: s.id,
      service_name: String(s.service_name || '').trim().slice(0, 120),
      price_note: String(s.price_note || '').trim().slice(0, 120) || null
    }))
    .filter(s => s.service_name);
}

// One row of the services editor. Used by both the signup wizard and
// the provider dashboard so the two cannot drift apart.
export function serviceRowHtml(service = {}) {
  return `
    <div class="service-row" data-id="${escapeHtml(service.id || '')}">
      <input class="form-input service-name" type="text" maxlength="120"
             placeholder="e.g. Geyser replacement" value="${escapeHtml(service.service_name || '')}"/>
      <input class="form-input service-price" type="text" maxlength="120"
             placeholder="Price note (optional)" value="${escapeHtml(service.price_note || '')}"/>
      <button type="button" class="btn btn-ghost btn-sm service-remove" aria-label="Remove service">✕</button>
    </div>`;
}

export function readServiceRows(container) {
  return [...container.querySelectorAll('.service-row')].map(row => ({
    id: row.dataset.id || undefined,
    service_name: row.querySelector('.service-name')?.value || '',
    price_note: row.querySelector('.service-price')?.value || ''
  })).filter(s => s.service_name.trim());
}

// Returns a controller because one editor instance is reused for every
// profile in the dashboard; calling init again would stack listeners.
export function initServiceList(container, initial = [], addBtn = null) {
  const paint = rows => {
    container.innerHTML = rows.length
      ? rows.map(serviceRowHtml).join('')
      : serviceRowHtml();
  };
  paint(initial);

  const addRow = () => {
    container.insertAdjacentHTML('beforeend', serviceRowHtml());
    container.querySelector('.service-row:last-child .service-name')?.focus();
  };

  addBtn?.addEventListener('click', addRow);
  container.addEventListener('click', e => {
    if (e.target.closest('.service-add')) addRow();
    else if (e.target.closest('.service-remove')) {
      const row = e.target.closest('.service-row');
      if (container.querySelectorAll('.service-row').length > 1) row.remove();
      else {
        row.querySelector('.service-name').value = '';
        row.querySelector('.service-price').value = '';
      }
    }
  });

  return {
    setRows: rows => paint(rows),
    read: () => readServiceRows(container)
  };
}

function generateSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + '-' + Math.random().toString(36).slice(2, 7);
}

export function renderProviderCard(provider) {
  const name = provider.business_name || provider.profiles?.full_name || 'Provider';
  const type = provider.provider_type === 'business' ? 'Business' : 'Individual';
  const services = provider.provider_services?.slice(0, 3).map(s => s.service_name) || [];
  const areas = provider.service_areas?.slice(0, 2).map(a => a.area_name) || [];

  const verBadges = [];
  if (provider.email_confirmed) verBadges.push('Email confirmed');
  if (provider.identity_reviewed) verBadges.push('Identity reviewed');
  if (provider.founding_provider) verBadges.push('Founding provider');

  const rating = Number(provider.rating_avg);
  const ratingHtml = provider.review_count > 0 && rating > 0
    ? `<span class="provider-card-rating">★ ${rating.toFixed(1)}
         <span class="provider-card-rating-count">(${provider.review_count})</span></span>`
    : `<span class="provider-card-rating provider-card-rating-new">New</span>`;

  return `
    <a href="/provider.html?slug=${encodeURIComponent(provider.slug)}" class="provider-card card-hover" style="text-decoration:none;color:inherit">
      <div class="provider-card-header">
        <div class="avatar avatar-lg" style="background:var(--green)">${escapeHtml(avatarInitials(name))}</div>
        <div style="flex:1;min-width:0">
          <div class="provider-card-name">${escapeHtml(name)}</div>
          <div class="provider-card-type">${type}</div>
          ${verBadges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${verBadges.map(b => `<span class="verify-badge">✓ ${escapeHtml(b)}</span>`).join('')}</div>` : ''}
        </div>
        ${ratingHtml}
      </div>
      ${provider.description ? `<p style="font-size:0.8125rem;color:var(--color-text-muted);line-height:1.5">${escapeHtml(truncate(provider.description, 100))}</p>` : ''}
      ${services.length ? `<div class="provider-card-services">${services.map(s => `<span class="badge badge-green">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      ${areas.length ? `<div class="provider-card-areas">📍 ${areas.map(a => escapeHtml(a)).join(', ')}</div>` : ''}
    </a>
  `;
}