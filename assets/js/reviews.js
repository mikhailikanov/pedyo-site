// Pedyo — Review submission and moderation
import { supabase } from './supabase-client.js';
import { escapeHtml, formatDate, renderStars } from './ui.js';
import { icon } from './icons.js';

export async function getProviderReviews(providerProfileId) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('provider_profile_id', providerProfileId)
      .eq('hidden', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Get reviews error:', e);
    return [];
  }
}

export async function submitReview(userId, providerProfileId, rating, content) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({ user_id: userId, provider_profile_id: providerProfileId, rating, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reportReview(userId, reviewId, reason) {
  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: userId, target_type: 'review', target_id: reviewId, reason });
  if (error) throw error;
}

export function renderReviewCard(review) {
  const name = review.profiles?.full_name || 'Anonymous';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `
    <div class="review-card">
      <div class="review-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="width:36px;height:36px;font-size:0.75rem">${escapeHtml(initials)}</div>
          <div>
            <div class="review-author">${escapeHtml(name)}</div>
            <div>${renderStars(review.rating)}</div>
          </div>
        </div>
        <div class="review-date">${formatDate(review.created_at)}</div>
      </div>
      ${review.content ? `<p class="review-body">${escapeHtml(review.content)}</p>` : ''}
    </div>
  `;
}

export function renderReviewForm(onSubmit) {
  return `
    <div class="card" style="margin-top:24px">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px">Leave a Review</h3>
      <form id="review-form">
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">Rating</label>
          <div id="star-picker" class="star-picker" role="radiogroup" aria-label="Your rating">
            ${[1,2,3,4,5].map(i => `<button type="button" class="star-pick" role="radio" aria-checked="false" aria-label="${i} star${i > 1 ? 's' : ''}" data-val="${i}" style="color:#CBD5E1">${icon('star', { size: 30, cls: 'icon-filled' })}</button>`).join('')}
          </div>
          <input type="hidden" id="review-rating" value="0">
        </div>
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label" for="review-content">Your review</label>
          <textarea class="form-textarea" id="review-content" placeholder="Share your experience…" rows="4"></textarea>
        </div>
        <div id="review-alert"></div>
        <button type="submit" class="btn btn-primary">Submit Review</button>
      </form>
    </div>
  `;
}

export function initStarPicker() {
  const picker = document.getElementById('star-picker');
  const input  = document.getElementById('review-rating');
  if (!picker || !input) return;
  const stars = [...picker.querySelectorAll('.star-pick')];
  let selected = Number(input.value) || 0;

  const paint = (upto) => stars.forEach(s => {
    const val = +s.dataset.val;
    s.style.color = val <= upto ? '#F4B942' : '#CBD5E1';
    s.setAttribute('aria-checked', String(val === selected));
  });

  stars.forEach(star => {
    star.addEventListener('mouseover', () => paint(+star.dataset.val));
    star.addEventListener('mouseout',  () => paint(selected));
    star.addEventListener('focus',     () => paint(+star.dataset.val));
    star.addEventListener('blur',      () => paint(selected));
    star.addEventListener('click', () => {
      selected = +star.dataset.val;
      input.value = selected;
      paint(selected);
    });
  });
  paint(selected);
}