// Pedyo — Shared admin sidebar nav builder
export function renderAdminSidebar(active = '') {
  const links = [
    { id: 'dashboard',    href: '/admin/index.html',           icon: '📊', label: 'Dashboard' },
    { id: 'providers',    href: '/admin/providers.html',        icon: '🏢', label: 'Provider Queue' },
    { id: 'images',       href: '/admin/images.html',           icon: '🖼️', label: 'Image Moderation' },
    { id: 'verification', href: '/admin/verification.html',     icon: '📋', label: 'Verification Docs' },
    { id: 'reports',      href: '/admin/reports.html',          icon: '🚩', label: 'Reports' },
    { id: 'reviews',      href: '/admin/reviews.html',          icon: '⭐', label: 'Reviews' },
    { id: 'categories',   href: '/admin/categories.html',       icon: '🗂️', label: 'Categories' },
    { id: 'users',        href: '/admin/users.html',            icon: '👥', label: 'Users' },
  ];
  return `
    <div class="sidebar-section-label">Admin Panel</div>
    ${links.map(l => `
      <a href="${l.href}" class="sidebar-link ${active === l.id ? 'active' : ''}">
        <span>${l.icon}</span>
        <span>${l.label}</span>
      </a>`).join('')}
    <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--color-border)">
      <a href="/" class="sidebar-link">
        <span>🏠</span><span>Back to site</span>
      </a>
    </div>`;
}