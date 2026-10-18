// Pedyo — Shared UI utilities
import { icon } from './icons.js';

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZW', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return formatDate(dateStr);
}

export function showAlert(container, message, type = 'error') {
  const icons = { error: 'x', success: 'check', info: 'info', warning: 'triangle-alert' };
  container.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      ${icon(icons[type] || 'info', { size: 16, stroke: 2.5 })}
      <span>${escapeHtml(message)}</span>
    </div>`;
}

export function clearAlert(container) {
  if (container) container.innerHTML = '';
}

// Native dialogs throw in some embedded webviews, which would make the calling
// button silently do nothing. Returns null when the admin cancels and undefined
// when no dialog could be shown at all, so callers can tell those apart.
export function askText(question) {
  try { return window.prompt(question); } catch { return undefined; }
}

export function setLoading(btn, loading, text = '') {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> ${text || 'Loading…'}`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || text;
  }
}

export function initTabs(container) {
  if (!container) return;
  const btns = container.querySelectorAll('.tab-btn');
  const panels = container.querySelectorAll('.tab-panel');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = container.querySelector(`#${btn.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });
  if (btns.length) btns[0].click();
}

export function renderStars(rating, max = 5) {
  const star = icon('star', { size: 14 });
  let html = '<span class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<span class="${i <= rating ? '' : 'empty'}">${star}</span>`;
  }
  html += '</span>';
  return html;
}

export function avatarInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Photo over initials. The initials stay underneath so a deleted object, a
// cold CDN or a blocked hotlink still shows a person instead of a blank circle.
export function renderAvatar(profile, size = '') {
  const cls = `avatar avatar-stack${size ? ' avatar-' + size : ''}`;
  const initials = avatarInitials(profile?.full_name);
  if (profile?.avatar_url) {
    return `<div class="${cls}">${escapeHtml(initials)}<img src="${escapeHtml(profile.avatar_url)}" alt="" onerror="this.style.display='none'"></div>`;
  }
  return `<div class="${cls}">${escapeHtml(initials)}</div>`;
}

export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

export function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

export function initDropdown(triggerSel, dropdownSel) {
  const trigger  = document.querySelector(triggerSel);
  const dropdown = document.querySelector(dropdownSel);
  if (!trigger || !dropdown) return;
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => dropdown.classList.add('hidden'));
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function truncate(str, len = 100) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export function renderVerificationBadges(flags) {
  const badges = [];
  if (flags?.email_confirmed)       badges.push('Email confirmed');
  if (flags?.contact_confirmed)     badges.push('Contact confirmed');
  if (flags?.identity_reviewed)     badges.push('Identity reviewed');
  if (flags?.business_docs_reviewed) badges.push('Business docs reviewed');
  if (flags?.founding_provider)     badges.push('Founding provider');
  const tick = icon('check', { size: 12, stroke: 3 });
  return badges.map(b => `<span class="verify-badge">${tick} ${escapeHtml(b)}</span>`).join('');
}