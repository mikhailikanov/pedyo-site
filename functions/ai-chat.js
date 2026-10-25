// Pedyo — provider concierge proxy
//
// Route: POST /ai-chat  (Cloudflare Pages picks this file up from /functions)
//
// The Groq key must never reach the browser, so the site calls this function
// and the function calls Groq. Set both bindings in Cloudflare dashboard →
// Settings → Functions → Environment variables, or with
//   wrangler pages secret put GROQ_API_KEY --project-name <project>
//   wrangler pages variable create GROQ_MODEL --project-name <project> --value openai/gpt-oss-120b
//
// Every listing on the marketplace is dumped into the prompt, so the candidate
// ceiling is a cost control as much as a context one: Groq metered accounts are
// capped on tokens per minute, and a 40-listing prompt is a quarter of that
// budget on its own. Raise MAX_CANDIDATES together with the account tier.
//
// The prompt is deliberately closed-world: the model may only name providers
// that the client passed in `candidates` and only link pages that it passed in
// `pages`, and every slug and path is checked back against those lists before
// it is returned, so neither a hallucinated business nor a made-up URL can
// become a link.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Groq retires model ids, so this is overridable with the GROQ_MODEL env
// binding. Checked against GET /openai/v1/models for this account: gpt-oss-120b
// follows the closed-world rules best; gpt-oss-20b is the faster fallback.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const MAX_TURNS = 12;
const MAX_CHARS_PER_TURN = 700;
const MAX_CANDIDATES = 16;
// The browser already ranks its page catalog against the customer's words and
// sends a shortlist; this is the ceiling it must not exceed.
const MAX_PAGES = 20;

const SYSTEM_PROMPT = `You are the Pedyo service concierge. Pedyo connects customers in Zimbabwe with local providers — plumbers, electricians, solar installers, drivers, cleaners, builders and more.

You are given CANDIDATES: real, approved Pedyo listings. You are also given PAGES: the real pages of the Pedyo site. Rules you must not break:
- Recommend only businesses that appear in CANDIDATES. Never invent a business, a name, a phone number, a WhatsApp number or a price.
- When the customer asks about a page, how to do something on the site, or how to reach the team, answer from PAGES and put the exact "path" of each relevant page in links. Never invent a path or a URL, and never link a page that is not in PAGES.
- If nothing in CANDIDATES fits the request, say so plainly and link the nearest page from PAGES instead of guessing.
- Answer the actual question first, then name up to three candidates, best fit first. At most 120 words.
- Ask one clarifying question only when the job is genuinely ambiguous (what, where, when).
- Plain text only: no markdown, no bullet characters, no headings. Do not repeat a path in the reply text, the link card shows it.
- Prices in USD or the customer's own currency wording. Never claim a booking was made.

Reply with JSON exactly of this shape:
{"reply":"<your answer>","picks":["<slug>"],"links":["<path from PAGES>"]}`;

// The client sends whole rows; only these fields are forwarded to the model.
// `Array.isArray` guards matter: this is a public endpoint, and a body with a
// string where a list belongs would otherwise throw before the first reply.
function compact(candidates) {
  return (Array.isArray(candidates) ? candidates : []).slice(0, MAX_CANDIDATES).map(c => ({
    slug: String(c.slug || '').slice(0, 80),
    name: String(c.business_name || '').slice(0, 80),
    category: String(c.primary_category || '').slice(0, 40),
    type: c.provider_type === 'business' ? 'business' : 'individual',
    rating: Number(c.rating_avg) || 0,
    reviews: Number(c.review_count) || 0,
    verified: Boolean(c.identity_reviewed),
    services: Array.isArray(c.services) ? c.services.slice(0, 3).map(s => String(s).slice(0, 40)) : [],
    areas: Array.isArray(c.areas) ? c.areas.slice(0, 3).map(s => String(s).slice(0, 40)) : [],
    blurb: String(c.description || '').slice(0, 110)
  })).filter(c => c.slug && c.name);
}

// Pages come from the browser too, for the same reason candidates do: this
// function has no idea what the site contains, and a path it has never seen
// cannot be trusted. A client that sends no list simply gets no links.
function compactPages(pages) {
  return (Array.isArray(pages) ? pages : []).slice(0, MAX_PAGES).map(p => ({
    path: String(p.path || '').slice(0, 100),
    title: String(p.title || '').slice(0, 60),
    hint: String(p.hint || '').slice(0, 110)
  })).filter(p => p.title && p.path.startsWith('/') && !p.path.startsWith('//'));
}

function cleanMessages(body) {
  const turns = Array.isArray(body?.messages) ? body.messages : [];
  return turns.slice(-MAX_TURNS)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS_PER_TURN) }))
    .filter(m => m.content);
}

// Best-effort throttle. A Pages Function isolate is shared and short-lived, so
// this blunts a script hammering the endpoint; it is not a quota system, and
// the real ceiling belongs on the Groq account behind the key.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const window = hits.get(ip) || [];
  window.push(now);
  while (window.length && now - window[0] > 60_000) window.shift();
  hits.set(ip, window);
  if (hits.size > 5000) hits.clear();
  return window.length > 20;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ...extra
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) {
    return json({ error: 'same_origin_only' }, 403);
  }
  if (!env.GROQ_API_KEY) {
    // Deployed without the secret: tell the caller, do not guess or crash.
    return json({ error: 'not_configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const messages = cleanMessages(body);
  const candidates = compact(body.candidates);
  const pages = compactPages(body.pages);
  if (!messages.length) return json({ error: 'bad_request' }, 400);
  if (messages[messages.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip)) return json({ error: 'slow_down' }, 429);

  const lastUser = messages[messages.length - 1].content.toLowerCase();
  const hint = candidates
    .filter(c => [c.name, c.category, ...c.services, ...c.areas]
      .some(field => field && lastUser.includes(String(field).toLowerCase())))
    .slice(0, 6);
  const pageHint = pages.filter(p => lastUser.includes(p.title.toLowerCase())).slice(0, 4);

  const prompt = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `CANDIDATES (${candidates.length} approved listings${hint.length ? `; these already match words the customer used: ${hint.map(h => h.slug).join(', ')}` : ''}):\n${JSON.stringify(candidates)}`
    },
    ...(pages.length ? [{
      role: 'system',
      content: `PAGES (${pages.length} pages on this site${pageHint.length ? `; the customer named: ${pageHint.map(p => p.path).join(', ')}` : ''}):\n${JSON.stringify(pages)}`
    }] : []),
    ...messages
  ];

  let groq;
  try {
    groq = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        messages: prompt,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });
  } catch (e) {
    console.error('Groq request failed:', e);
    return json({ error: 'assistant_unavailable' }, 502);
  }

  if (!groq.ok) {
    console.error(`Groq ${groq.status}: ${(await groq.text()).slice(0, 300)}`);
    if (groq.status === 429) {
      // Groq metered the account, not this site. A 429 out lets the panel say
      // "wait a moment" truthfully instead of reporting a broken assistant.
      return json({ error: 'assistant_busy' }, 429, { 'Retry-After': '15' });
    }
    // Groq's own message can quote request details; keep it out of the response.
    return json({ error: groq.status === 401 ? 'not_configured' : 'assistant_unavailable' }, 502);
  }

  const data = await groq.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  // prompt_tokens now carries the candidate list and the page catalog: watch it
  // before raising MAX_CANDIDATES or MAX_PAGES.
  console.log(`groq ok ${data?.usage?.total_tokens ?? '?'} tokens (${candidates.length} candidates, ${pages.length} pages)`);

  let reply = '';
  let picks = [];
  let links = [];
  try {
    const parsed = JSON.parse(raw);
    reply = String(parsed.reply || '').trim();
    picks = Array.isArray(parsed.picks) ? parsed.picks : [];
    links = Array.isArray(parsed.links) ? parsed.links.map(l => String(l)) : [];
  } catch {
    // A non-JSON answer still deserves to reach the customer.
    reply = raw.trim();
  }

  const known = new Set(candidates.map(c => c.slug));
  const knownPaths = new Set(pages.map(p => p.path));
  return json({
    reply: reply.slice(0, 1200),
    picks: picks.filter(slug => known.has(slug)).slice(0, 3),
    links: links.filter(path => knownPaths.has(path)).slice(0, 3)
  });
}

// A GET here would be a probe; say what the endpoint expects instead of 405 HTML.
export function onRequest() {
  return json({ error: 'use_post' }, 405);
}
