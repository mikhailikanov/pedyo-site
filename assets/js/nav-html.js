// Pedyo — Shared navigation, footer and logo templates.
// The mark is inline SVG so it stays crisp at any size and keeps its
// two-tone colour on dark backgrounds (the old PNG needed a filter hack).
const MARK_PATHS = (id) => `
  <defs>
    <linearGradient id="${id}" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1E9B70"/><stop offset="1" stop-color="#0A5240"/>
    </linearGradient>
  </defs>
  <path fill="url(#${id})" d="M12 22.6C12 22.6 4.1 14.9 4.1 9.6a7.9 7.9 0 1 1 15.8 0c0 5.3-7.9 13-7.9 13Z"/>
  <g fill="none" stroke="#31B37C" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 5.2v8.8"/><path d="M8.5 5.2h3.6a2.7 2.7 0 0 1 0 5.4H8.5"/>
  </g>
  <path fill="none" stroke="#F4B942" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m12.1 8.5 1.8 1.8 3.6-4.2"/>`;

export function renderLogo(variant = 'nav') {
  return `<a href="/" class="logo">
  <svg class="logo-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${MARK_PATHS(`pedyo-pin-${variant}`)}</svg>
  <span class="logo-word">Pedyo</span>
</a>`;
}

export function renderNav(activePage = '') {
  return `
<nav class="nav">
  <div class="nav-inner">
    ${renderLogo('nav')}
    <div class="nav-links" id="nav-links">
      <a href="/services.html" class="nav-link ${activePage==='services'?'active':''}">Services</a>
      <a href="/search.html"   class="nav-link ${activePage==='search'?'active':''}">Find Providers</a>
      <a href="/about.html"    class="nav-link ${activePage==='about'?'active':''}">About</a>
      <a href="/contact.html"  class="nav-link ${activePage==='contact'?'active':''}">Contact</a>
    </div>
    <div class="nav-actions" id="nav-actions">
      <!-- Populated by nav.js -->
    </div>
    <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>`;
}

export function renderFooter() {
  return `
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-brand">
      ${renderLogo('footer')}
      <p>Trusted services, close to you.<br>Pedyo connects customers with verified plumbers, electricians, solar installers and more across Zimbabwe.</p>
      <div class="footer-badges">
        <span class="footer-badge">ID-checked providers</span>
        <span class="footer-badge">Photo moderation</span>
        <span class="footer-badge">Free to browse</span>
      </div>
    </div>
    <div class="footer-col">
      <h4>Services</h4>
      <a href="/services/solar-water.html">Solar &amp; Water</a>
      <a href="/services/plumbing.html">Plumbing</a>
      <a href="/services/electrical.html">Electrical</a>
      <a href="/services/transport.html">Transport &amp; Delivery</a>
      <a href="/services/construction.html">Construction</a>
      <a href="/services/cleaning.html">Cleaning</a>
    </div>
    <div class="footer-col">
      <h4>Platform</h4>
      <a href="/about.html">About Pedyo</a>
      <a href="/contact.html">Contact</a>
      <a href="/account/become-provider.html">Become a Provider</a>
      <a href="/account/register.html">Create Account</a>
    </div>
    <div class="footer-col">
      <h4>Legal</h4>
      <a href="/legal/terms.html">Terms of Use</a>
      <a href="/legal/privacy.html">Privacy Policy</a>
      <a href="/legal/safety.html">Safety Guidelines</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} Pedyo. All rights reserved. Zimbabwe.</span>
    <span>Trusted services, close to you.</span>
  </div>
</footer>`;
}
