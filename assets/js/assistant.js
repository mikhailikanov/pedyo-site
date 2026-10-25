// Pedyo — provider concierge
//
// The browser never sees the Groq key: POST /ai-chat (functions/ai-chat.js)
// holds it and makes the upstream call. This panel only ever receives slugs
// that it sent out, and it renders links by looking them up in `pool`, so a
// hallucinated business cannot become a link here even if the proxy let one
// through. Site pages work the same way: the catalog in site-pages.js travels
// with the question and a returned path is dropped unless it is in that list.
import { icon } from './icons.js';
import { escapeHtml } from './ui.js';
import { searchProviders } from './providers.js';
import { pagesForModel, pageByPath, requestedPages } from './site-pages.js';

const STORE_KEY = 'pedyo_concierge';
const POS_KEY = 'pedyo_dock_pos';
const DOCK_MARGIN = 8;
const MAX_POOL = 40;
// Groq metered accounts are capped on tokens per minute and every candidate
// costs prompt tokens, so the panel forwards a shortlist rather than the whole
// pool. The proxy caps it again at MAX_CANDIDATES.
const SEND_MAX = 12;
const MAX_TURNS = 12;

const CHIPS = ['A leaking geyser', 'Solar for my shop', 'House rewiring', 'Office cleaning', 'A driver today', 'Contact us page'];

const WELCOME = 'Tell me what needs doing — the trade, and where you are. I suggest providers with an approved Pedyo listing and I can point you to any page on the site. I never give a price or a phone number.';

// Words that describe asking rather than the job, so they cannot pull in
// every listing that happens to mention "service".
const STOP = new Set(['the', 'and', 'for', 'you', 'your', 'need', 'want', 'please', 'can', 'get',
  'some', 'with', 'that', 'this', 'have', 'what', 'who', 'how', 'much', 'does', 'cost', 'price',
  'looking', 'something', 'help', 'about', 'near', 'around', 'know', 'them', 'they', 'there',
  'from', 'into', 'just', 'like', 'good', 'best', 'today', 'now', 'any', 'one']);

let root = null;
let log = null;
let input = null;
let pool = [];
let poolPromise = null;
let turns = [];
let busy = false;

export function mountAssistant() {
  if (root || location.pathname.startsWith('/admin/')) return;
  turns = readStore();

  root = document.createElement('div');
  root.className = 'ai-dock';
  root.innerHTML = `
    <button class="ai-launcher" id="ai-launcher" aria-expanded="false" aria-controls="ai-panel">
      ${icon('sparkles', { size: 18 })}<span>Ask Pedyo</span>
    </button>
    <section class="ai-panel hidden" id="ai-panel" role="dialog" aria-label="Pedyo service concierge">
      <header class="ai-head">
        <span class="ai-head-icon">${icon('sparkles', { size: 16 })}</span>
        <div class="ai-head-text">
          <strong>Service concierge</strong>
          <small id="ai-scope">Live listings and every site page</small>
        </div>
        <button class="ai-head-btn" id="ai-reset" type="button" aria-label="Start a new conversation">${icon('plus', { size: 15 })}</button>
        <button class="ai-head-btn" id="ai-close" type="button" aria-label="Close the concierge">${icon('x', { size: 16 })}</button>
      </header>
      <div class="ai-log" id="ai-log" aria-live="polite"></div>
      <div class="ai-chips" id="ai-chips">
        ${CHIPS.map(c => `<button type="button" class="ai-chip">${escapeHtml(c)}</button>`).join('')}
      </div>
      <form class="ai-form" id="ai-form" autocomplete="off">
        <input class="ai-input" id="ai-input" type="text" maxlength="400"
               placeholder="What do you need done?" aria-label="Your question">
        <button class="ai-send" type="submit" aria-label="Send">${icon('send', { size: 16 })}</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  log = root.querySelector('#ai-log');
  input = root.querySelector('#ai-input');
  const panel = root.querySelector('#ai-panel');
  const launcher = root.querySelector('#ai-launcher');

  // The dock is parked out of the way by the CSS default, but a fixed corner is
  // still somebody's button, so it can be dragged or nudged and the spot is kept.
  let pos = null;
  const place = (right, bottom) => {
    const maxRight = Math.max(DOCK_MARGIN, window.innerWidth - root.offsetWidth - DOCK_MARGIN);
    const maxBottom = Math.max(DOCK_MARGIN, window.innerHeight - root.offsetHeight - DOCK_MARGIN);
    pos = {
      right: Math.min(Math.max(right, DOCK_MARGIN), maxRight),
      bottom: Math.min(Math.max(bottom, DOCK_MARGIN), maxBottom),
    };
    root.style.right = `${pos.right}px`;
    root.style.bottom = `${pos.bottom}px`;
    return pos;
  };
  const restore = () => {
    const saved = readPos();
    if (saved) place(saved.right, saved.bottom);
  };
  restore();
  window.addEventListener('resize', restore);

  let drag = null;
  let dragged = false;
  launcher.title = 'Drag, or press an arrow key, to move the concierge';

  launcher.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const box = root.getBoundingClientRect();
    drag = {
      x: e.clientX,
      y: e.clientY,
      right: window.innerWidth - box.right,
      bottom: window.innerHeight - box.bottom,
    };
    dragged = false;
    // Touch pointers already hold implicit capture on their target, and some
    // browsers reject an explicit request for them. Losing the capture must not
    // lose the drag, so the failure is swallowed and the move events keep
    // arriving on this element either way.
    try { launcher.setPointerCapture(e.pointerId); } catch {}
  });

  launcher.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 6) return;
    dragged = true;
    launcher.classList.add('dragging');
    place(drag.right - dx, drag.bottom - dy);
  });

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    launcher.classList.remove('dragging');
    if (dragged && pos) writePos(pos);
  };
  launcher.addEventListener('pointerup', endDrag);
  launcher.addEventListener('pointercancel', endDrag);

  launcher.addEventListener('keydown', e => {
    const step = e.shiftKey ? 40 : 12;
    const moves = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const box = root.getBoundingClientRect();
    const from = pos || { right: window.innerWidth - box.right, bottom: window.innerHeight - box.bottom };
    writePos(place(from.right + move[0], from.bottom + move[1]));
  });

  let openFrom = null;
  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    launcher.classList.toggle('hidden', open);
    launcher.setAttribute('aria-expanded', String(open));
    if (open) {
      paint();
      ensurePool().catch(() => {});
      // An open panel is far taller than the launcher, so the parked spot may no
      // longer fit. The launcher is hidden while open, so the shift is invisible
      // and the original spot comes back on close.
      if (pos) {
        openFrom = pos;
        place(pos.right, pos.bottom);
      }
      input.focus();
    } else if (openFrom) {
      const back = openFrom;
      openFrom = null;
      place(back.right, back.bottom);
    }
  };

  launcher.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    setOpen(true);
  });
  root.querySelector('#ai-close').addEventListener('click', () => {
    setOpen(false);
    launcher.focus();
  });
  root.querySelector('#ai-reset').addEventListener('click', () => {
    turns = [];
    try { sessionStorage.removeItem(STORE_KEY); } catch {}
    paint();
    input.focus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) setOpen(false);
  });
  root.querySelector('#ai-chips').addEventListener('click', e => {
    const chip = e.target.closest('.ai-chip');
    if (chip) { input.value = chip.textContent; input.focus(); }
  });
  root.querySelector('#ai-form').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    ask(text);
  });
}

async function ensurePool() {
  if (pool.length) return;
  try {
    await (poolPromise ||= loadPool());
  } finally {
    // A failed or empty read must not be cached forever: listings get approved
    // while the tab stays open.
    if (!pool.length) poolPromise = null;
  }
  paintScope();
  // Turns restored from a previous page carry slugs; they only resolve into
  // cards once the pool is here.
  if (!busy) paint();
}

async function loadPool() {
  // Approved listings only, best-rated first: searchProviders filters on
  // status and this is the whole world the concierge is allowed to talk about.
  const { providers } = await searchProviders({ sort: 'rating', limit: MAX_POOL });
  pool = providers.map(c => ({
    slug: c.slug,
    business_name: c.business_name || c.profiles?.full_name || 'Provider',
    avatar_url: c.avatar_url || '',
    primary_category: c.provider_services?.[0]?.category || '',
    provider_type: c.provider_type,
    rating_avg: Number(c.rating_avg) || 0,
    review_count: Number(c.review_count) || 0,
    identity_reviewed: Boolean(c.identity_reviewed),
    description: c.description || '',
    services: (c.provider_services || []).map(s => s.service_name).filter(Boolean),
    areas: (c.service_areas || []).map(a => a.area_name).filter(Boolean)
  })).filter(c => c.slug);
}

function paintScope() {
  const el = root?.querySelector('#ai-scope');
  if (el) el.textContent = pool.length
    ? `${pool.length} live listing${pool.length === 1 ? '' : 's'} and every site page`
    : 'Live listings and every site page';
}

function words(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
}

function score(c, list) {
  let s = 0;
  for (const w of list) {
    if (c.business_name.toLowerCase().includes(w)) s += 3;
    if (c.primary_category.toLowerCase().includes(w)) s += 2;
    if (c.services.some(x => x.toLowerCase().includes(w))) s += 2;
    if (c.areas.some(x => x.toLowerCase().includes(w))) s += 2;
    if (c.description.toLowerCase().includes(w)) s += 1;
  }
  return s;
}

// The proxy caps what it forwards, so the client decides who is worth showing:
// listings matching the customer's own words go first, the rest follow so a
// loose question still gets a real answer instead of nothing.
function candidatesFor(text) {
  const list = words(text);
  if (!list.length || pool.length <= 6) return pool.slice(0, SEND_MAX);
  const scored = pool.map(c => ({ c, s: score(c, list) }));
  const hits = scored.filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  const rest = scored.filter(x => x.s === 0);
  return [...hits, ...rest].slice(0, SEND_MAX).map(x => x.c);
}

async function ask(text) {
  turns = [...turns, { role: 'user', content: text }].slice(-MAX_TURNS);

  // Asking for a page has a certain answer, so it is served from the catalog
  // without a model call: no tokens, no latency, and it still works when Groq
  // is down. A trade question matches only category pages, and those fall
  // through so the visitor gets real listings rather than a directory page.
  const nav = requestedPages(text);
  if (nav.length && !nav[0].category) {
    const names = nav.map(p => p.title);
    turns = [...turns, {
      role: 'assistant',
      content: names.length === 1
        ? `Yes — the ${names[0]} page is on Pedyo. Open it from the link below.`
        : `Yes — Pedyo has both ${names[0]} and ${names[1]}. Open them from the links below.`,
      picks: [],
      links: nav.map(p => p.path)
    }].slice(-MAX_TURNS);
    paint();
    writeStore();
    return;
  }

  busy = true;
  paint();
  writeStore();

  const thinking = document.createElement('div');
  thinking.className = 'ai-thinking';
  thinking.innerHTML = `<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>`;
  log.appendChild(thinking);
  log.scrollTop = log.scrollHeight;

  let payload = null;
  let note = '';
  try {
    await ensurePool();   // never send a question with an empty world
    // avatar_url is only for the pick cards. Prompt tokens are metered, so
    // neither a long URL per candidate nor the whole page catalog leaves the
    // browser: both travel as a shortlist ranked by the customer's own words.
    const packet = JSON.stringify({
      messages: turns,
      candidates: candidatesFor(text).map(({ avatar_url, ...c }) => c),
      pages: pagesForModel(text)
    });
    const post = () => fetch('/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: packet
    });
    let res = await post();
    // A 502 means Groq failed the hop, and it is most often the first question
    // after the function has sat idle. One retry costs nothing and saves the
    // visitor a dead bubble. A 429 is a metered limit, so it is never retried.
    if (res.status === 502) {
      await new Promise(r => setTimeout(r, 900));
      res = await post();
    }
    payload = await res.json().catch(() => null);
    if (!res.ok) {
      note = res.status === 503 || payload?.error === 'not_configured'
        ? 'The concierge is not connected yet, so I cannot answer about providers. Ask me for a page by name and I can still link it, or use the Services page to browse by trade.'
        : res.status === 429
          ? 'The concierge is busy right now — give it a few seconds and ask again.'
          : 'Something went wrong reaching the concierge. Try again in a moment.';
      payload = null;
    } else if (!payload?.reply) {
      note = 'The concierge came back with nothing. Try asking in a different way.';
      payload = null;
    }
  } catch {
    note = 'You appear to be offline — nothing came through.';
  }

  thinking.remove();
  busy = false;

  if (!payload) {
    turns = turns.slice(0, -1);   // an unanswered question is not a conversation
    paint({ text: note });
    writeStore();
    return;
  }

  turns = [...turns, { role: 'assistant', content: payload.reply, picks: payload.picks || [], links: knownLinks(payload.links) }].slice(-MAX_TURNS);
  paint();
  writeStore();
}

// The proxy already checks paths against the catalog it received, but a link
// that is not in this browser's list would render as a dead chip, so the panel
// filters again on its own copy of the truth.
function knownLinks(paths) {
  return (Array.isArray(paths) ? paths : [])
    .map(pageByPath)
    .filter(Boolean)
    .slice(0, 3)
    .map(p => p.path);
}

function bySlug(slug) {
  return pool.find(c => c.slug === slug);
}

function pickCard(c) {
  const rating = c.review_count > 0 && c.rating_avg > 0
    ? `<span class="ai-pick-rating">${icon('star', { size: 12, cls: 'icon-filled' })} ${c.rating_avg.toFixed(1)}<span> (${c.review_count})</span></span>`
    : '<span class="ai-pick-new">New</span>';
  return `
    <a class="ai-pick" href="/provider.html?slug=${encodeURIComponent(c.slug)}">
      <span class="ai-pick-avatar">${c.avatar_url ? `<img src="${escapeHtml(c.avatar_url)}" alt="">` : escapeHtml(c.business_name.trim().charAt(0).toUpperCase() || '?')}</span>
      <span class="ai-pick-body">
        <span class="ai-pick-name">${escapeHtml(c.business_name)}${c.identity_reviewed ? icon('badge-check', { size: 14, cls: 'ai-pick-ver' }) : ''}</span>
        <span class="ai-pick-meta">${escapeHtml(c.primary_category || (c.services[0] || 'Pedyo provider'))}${c.areas[0] ? ` · ${escapeHtml(c.areas[0])}` : ''}</span>
      </span>
      ${rating}
    </a>`;
}

function pageChip(p) {
  return `
    <a class="ai-page" href="${escapeHtml(p.path)}">
      <span class="ai-page-icon">${icon(p.icon, { size: 15 })}</span>
      <span class="ai-page-body">
        <span class="ai-page-title">${escapeHtml(p.title)}</span>
        <span class="ai-page-hint">${escapeHtml(p.hint)}</span>
      </span>
    </a>`;
}

function paint(transient) {
  if (!log) return;
  // Answers are part of `turns`, so they survive clicking through to a listing.
  // `transient` is a bubble that never entered the conversation — an apology
  // for a turn that did not land — and disappears on the next send.
  log.innerHTML =
    botBubble({ text: WELCOME }) +
    turns.map(t => t.role === 'user'
      ? `<div class="ai-msg ai-msg-me"><div class="ai-bubble">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div></div>`
      : botBubble({ text: t.content, picks: t.picks, links: t.links })).join('') +
    (transient ? botBubble({ text: transient.text, error: true }) : '');
  log.scrollTop = log.scrollHeight;
  const send = root.querySelector('.ai-send');
  if (send) send.disabled = busy;
}

function botBubble({ text, picks = [], links = [], error = false }) {
  const cards = picks.map(s => { const c = bySlug(s); return c ? pickCard(c) : ''; }).join('');
  const pages = links.map(pageByPath).filter(Boolean).map(pageChip).join('');
  return `
    <div class="ai-msg ai-msg-bot">
      <div class="ai-bubble${error ? ' ai-bubble-err' : ''}">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
      ${cards ? `<div class="ai-picks">${cards}</div>` : ''}
      ${pages ? `<div class="ai-pages">${pages}</div>` : ''}
    </div>`;
}

function readStore() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORE_KEY));
    return Array.isArray(raw)
      ? raw
          .filter(t => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
          .slice(-MAX_TURNS)
          .map(t => ({
            role: t.role,
            content: t.content,
            picks: Array.isArray(t.picks) ? t.picks : [],
            links: knownLinks(t.links)
          }))
      : [];
  } catch {
    return [];
  }
}

function writeStore() {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(turns)); } catch {}
}

function readPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY));
    if (!raw || !Number.isFinite(raw.right) || !Number.isFinite(raw.bottom)) return null;
    return { right: raw.right, bottom: raw.bottom };
  } catch {
    return null;
  }
}

function writePos(p) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
}
