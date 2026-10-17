// Pedyo — Administrator panel functions
import { supabase } from './supabase-client.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
export async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = '/account/login.html'; return false; }
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) { window.location.href = '/'; return false; }
  return user;
}

// ── Provider queue ────────────────────────────────────────────────────────────
export async function getPendingProviders() {
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('*, profiles(full_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function approveProvider(profileId, adminId) {
  const { error } = await supabase
    .from('provider_profiles')
    .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error) throw error;
  await logAdminAction(adminId, 'approve_provider', profileId);
}

export async function rejectProvider(profileId, adminId, reason) {
  const { error } = await supabase
    .from('provider_profiles')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error) throw error;
  await logAdminAction(adminId, 'reject_provider', profileId, { reason });
}

export async function suspendProvider(profileId, adminId, reason) {
  const { error } = await supabase
    .from('provider_profiles')
    .update({ status: 'suspended', rejection_reason: reason })
    .eq('id', profileId);
  if (error) throw error;
  await logAdminAction(adminId, 'suspend_provider', profileId, { reason });
}

// ── Verification badges ───────────────────────────────────────────────────────
export async function setVerificationBadge(profileId, badge, value, adminId) {
  const update = { [badge]: value };
  const { error } = await supabase
    .from('provider_profiles').update(update).eq('id', profileId);
  if (error) throw error;
  await logAdminAction(adminId, `set_badge_${badge}`, profileId, { value });
}

// ── Image moderation ──────────────────────────────────────────────────────────
export async function getPendingImages() {
  const { data, error } = await supabase
    .from('provider_images')
    .select('*, provider_profiles(business_name)')
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function approveImage(imageId, adminId) {
  const { error } = await supabase
    .from('provider_images')
    .update({ moderation_status: 'approved' })
    .eq('id', imageId);
  if (error) throw error;
  await logAdminAction(adminId, 'approve_image', imageId);
}

export async function rejectImage(imageId, adminId) {
  const { error } = await supabase
    .from('provider_images')
    .update({ moderation_status: 'rejected' })
    .eq('id', imageId);
  if (error) throw error;
  await logAdminAction(adminId, 'reject_image', imageId);
}

// ── Categories ────────────────────────────────────────────────────────────────
export async function getCategories() {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCategory(name, adminId) {
  const { data: existing } = await supabase
    .from('service_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = (existing?.sort_order || 0) + 1;
  const { data, error } = await supabase
    .from('service_categories')
    .insert({ name, sort_order: nextOrder, is_active: true })
    .select().single();
  if (error) throw error;
  await logAdminAction(adminId, 'create_category', data.id, { name });
  return data;
}

export async function updateCategory(id, updates, adminId) {
  const { error } = await supabase
    .from('service_categories').update(updates).eq('id', id);
  if (error) throw error;
  await logAdminAction(adminId, 'update_category', id, updates);
}

export async function toggleCategory(id, isActive, adminId) {
  await updateCategory(id, { is_active: isActive }, adminId);
}

// ── Reports ───────────────────────────────────────────────────────────────────
export async function getOpenReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*, profiles(full_name, email)')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function resolveReport(reportId, adminId, resolution) {
  const { error } = await supabase
    .from('reports')
    .update({ status: 'resolved', resolution, resolved_by: adminId, resolved_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw error;
  await logAdminAction(adminId, 'resolve_report', reportId, { resolution });
}

// ── Reviews moderation ────────────────────────────────────────────────────────
export async function getAllReviews({ page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from('reviews')
    .select('*, profiles(full_name), provider_profiles(business_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  return { reviews: data || [], total: count || 0 };
}

export async function toggleReviewVisibility(reviewId, hidden, adminId) {
  const { error } = await supabase
    .from('reviews').update({ hidden }).eq('id', reviewId);
  if (error) throw error;
  await logAdminAction(adminId, hidden ? 'hide_review' : 'unhide_review', reviewId);
}

// ── Users ─────────────────────────────────────────────────────────────────────
export async function searchUsers(query) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(50);
  if (error) throw error;
  return data || [];
}

// ── Verification docs ─────────────────────────────────────────────────────────
export async function getVerificationRequests() {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*, profiles(full_name, email), provider_profiles(business_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getVerificationDocUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('verification-docs')
    .createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export async function getPlatformStats() {
  const [users, providers, pending, reviews] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('*', { count: 'exact', head: true })
  ]);
  return {
    totalUsers: users.count || 0,
    approvedProviders: providers.count || 0,
    pendingProviders: pending.count || 0,
    totalReviews: reviews.count || 0
  };
}

// ── Audit log ─────────────────────────────────────────────────────────────────
async function logAdminAction(adminId, action, targetId, meta = {}) {
  try {
    await supabase.from('audit_log').insert({
      admin_id: adminId, action, target_id: String(targetId), meta
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
}