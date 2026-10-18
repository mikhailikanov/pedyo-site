// Pedyo — File upload, validation, compression
import { supabase } from './supabase-client.js';
import { icon } from './icons.js';

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG and WebP images are allowed.');
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Image must be under ${MAX_SIZE_MB}MB.`);
  }
}

export async function compressImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Compression failed'));
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

// A person and their listings keep separate objects, so changing a business
// logo never touches the owner's face. Both keys sit under the owner's uid as
// the second segment, which is what storage_profiles_owner_write checks, and
// the listing id is its own directory — the two can never overwrite each other.
export const userAvatarKey = userId => `avatars/${userId}/avatar.jpg`;
export const providerAvatarKey = (userId, providerId) => `avatars/${userId}/providers/${providerId}/avatar.jpg`;

async function putAvatar(path, file) {
  validateImage(file);
  const compressed = await compressImage(file, 400, 0.9);
  const { error } = await supabase.storage
    .from('profiles')
    .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('profiles').getPublicUrl(path);
  // One fixed key per identity means the CDN and the browser both hold the
  // last face forever, so the stored URL carries the upload time.
  return { url: `${data.publicUrl}?v=${Date.now()}`, path };
}

export function uploadUserAvatar(userId, file) {
  return putAvatar(userAvatarKey(userId), file);
}

export function uploadProviderAvatar(userId, providerId, file) {
  return putAvatar(providerAvatarKey(userId, providerId), file);
}

export async function uploadGalleryImage(providerId, file) {
  validateImage(file);
  const compressed = await compressImage(file, 1200, 0.85);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const path = `gallery/${providerId}/${filename}`;
  const { error } = await supabase.storage
    .from('providers')
    .upload(path, compressed, { contentType: 'image/jpeg' });
  if (error) throw error;

  // Insert into provider_images table (pending moderation)
  const { data } = supabase.storage.from('providers').getPublicUrl(path);
  await supabase.from('provider_images').insert({
    provider_profile_id: providerId,
    storage_path: path,
    public_url: data.publicUrl,
    moderation_status: 'pending'
  });
  return data.publicUrl;
}

export async function uploadVerificationDoc(userId, file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) throw new Error('Only images and PDFs are allowed.');
  if (file.size > 10 * 1024 * 1024) throw new Error('File must be under 10MB.');

  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}.${ext}`;
  const path = `verification/${userId}/${filename}`;

  const { error } = await supabase.storage
    .from('verification-docs')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export function renderImagePreview(url, container, onRemove) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:inline-block';
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid var(--color-border)';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerHTML = icon('x', { size: 12, stroke: 2.5 });
  btn.style.cssText = 'position:absolute;top:-6px;right:-6px;background:var(--color-danger);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center';
  btn.onclick = () => { wrap.remove(); if (onRemove) onRemove(); };
  wrap.appendChild(img);
  wrap.appendChild(btn);
  container.appendChild(wrap);
}