// Pedyo — User profile CRUD
import { supabase } from './supabase-client.js';

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Get profile error:', e);
    return null;
  }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, profileData) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profileData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function requestAccountDeletion(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ deletion_requested: true, deletion_requested_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}