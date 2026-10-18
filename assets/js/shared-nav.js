// Pedyo — Shared admin sidebar nav builder
import { icon } from './icons.js';

export function renderAdminSidebar(active = '') {
  const links = [
    { id: 'dashboard',    href: '/admin/index.html',           icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'providers',    href: '/admin/providers.html',        icon: 'building-2',       label: 'Provider Queue' },
    { id: 'images',       href: '/admin/images.html',           icon: 'image',            label: 'Image Moderation' },
    { id: 'verification', href: '/admin/verification.html',     icon: 'clipboard-check',  label: 'Verification Docs' },
    { id: 'reports',      href: '/admin/reports.html',          icon: 'flag',             label: 'Reports' },
    { id: 'reviews',      href: '/admin/reviews.html',          icon: 'star',             label: 'Reviews' },
    { id: 'terms',        href: '/admin/terms.html',            icon: 'shield-check',     label: 'Blocked Words' },
    { id: 'categories',   href: '/admin/categories.html',       icon: 'folder',           label: 'Categories' },
    { id: 'users',        href: '/admin/users.html',            icon: 'users',            label: 'Users' },
  ];
  return `
    <div class="sidebar-section-label">Admin Panel</div>
    ${links.map(l => `
      <a href="${l.href}" class="sidebar-link ${active === l.id ? 'active' : ''}">
        ${icon(l.icon, { size: 18 })}
        <span>${l.label}</span>
      </a>`).join('')}
    <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--color-border)">
      <a href="/" class="sidebar-link">
        ${icon('house', { size: 18 })}<span>Back to site</span>
      </a>
    </div>`;
}