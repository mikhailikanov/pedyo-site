// Pedyo — Service category loading
import { supabase } from './supabase-client.js';
import { escapeHtml } from './ui.js';

const CATEGORY_ICONS = {
  'Solar, Inverters & Water': '☀️',
  'Plumbing': '🔧',
  'Electrical': '⚡',
  'Transport & Delivery': '🚚',
  'Construction & Repairs': '🏗️',
  'Cleaning & Property Care': '🧹',
  'Automotive': '🚗',
  'Events': '🎉',
  'Education & Tutoring': '📚',
  'Digital & Business Services': '💻',
  'Appliance Repair': '🔌',
  'Property Care': '🏡'
};

export async function loadCategories() {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // If no results or error, try without the is_active filter
    // (handles cases where column doesn't exist or all rows have null/false)
    if (error || !data || data.length === 0) {
      const fallback = await supabase
        .from('service_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!fallback.error && fallback.data?.length) {
        return fallback.data;
      }
    }

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Load categories error:', e);
    // Return hardcoded fallback so the UI never shows empty
    return FALLBACK_CATEGORIES;
  }
}

// Hardcoded fallback in case Supabase categories table is empty or unreachable
const FALLBACK_CATEGORIES = [
  { id: 1,  name: 'Solar, Inverters & Water',    sort_order: 1,  is_active: true },
  { id: 2,  name: 'Plumbing',                    sort_order: 2,  is_active: true },
  { id: 3,  name: 'Electrical',                  sort_order: 3,  is_active: true },
  { id: 4,  name: 'Transport & Delivery',        sort_order: 4,  is_active: true },
  { id: 5,  name: 'Construction & Repairs',      sort_order: 5,  is_active: true },
  { id: 6,  name: 'Cleaning & Property Care',    sort_order: 6,  is_active: true },
  { id: 7,  name: 'Automotive',                  sort_order: 7,  is_active: true },
  { id: 8,  name: 'Events',                      sort_order: 8,  is_active: true },
  { id: 9,  name: 'Education & Tutoring',        sort_order: 9,  is_active: true },
  { id: 10, name: 'Digital & Business Services', sort_order: 10, is_active: true },
  { id: 11, name: 'Appliance Repair',            sort_order: 11, is_active: true },
  { id: 12, name: 'Property Care',               sort_order: 12, is_active: true },
];

export function getCategoryIcon(name) {
  return CATEGORY_ICONS[name] || '🔨';
}

export function renderCategoryGrid(categories, container, linkPrefix = '/search.html?category=') {
  if (!container) return;
  if (!categories.length) {
    container.innerHTML = '<p class="text-muted text-center">No categories available yet.</p>';
    return;
  }
  container.innerHTML = categories.map(cat => `
    <a href="${linkPrefix}${encodeURIComponent(cat.name)}" class="category-card">
      <div class="category-icon">${getCategoryIcon(cat.name)}</div>
      <h3>${escapeHtml(cat.name)}</h3>
    </a>
  `).join('');
}