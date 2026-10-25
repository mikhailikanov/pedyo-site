// Pedyo — every page a visitor can be sent to
//
// The concierge used to only know listings, so "is there a contact us page?"
// answered "I could not find that". This list is the second half of its world:
// the static pages of the site.
//
// Hard-coded on purpose. A category only appears here once its page file
// exists, so an admin adding a thirteenth category cannot make the concierge
// link to something that 404s. `hint` is what leaves the browser for the model;
// `words` is only used for the local match, so what a customer calls a page
// never costs prompt tokens.
export const SITE_PAGES = [
  { path: '/', title: 'Home', icon: 'house', hint: 'Pedyo front page: search box, categories and featured providers.', words: ['home', 'homepage', 'front page', 'start over', 'main page'] },
  { path: '/search.html', title: 'Find Providers', icon: 'search', hint: 'Search every approved listing, filter by category, area, provider type and verification.', words: ['search', 'find a provider', 'results', 'filter', 'browse', 'list of providers'] },
  { path: '/services.html', title: 'Services', icon: 'layout-dashboard', hint: 'All Pedyo service categories in one page, with how many businesses are in each.', words: ['services', 'categories', 'trades', 'what do you offer', 'types of service'] },
  { path: '/about.html', title: 'About Pedyo', icon: 'info', hint: 'What Pedyo is, who builds it and how it works in Harare and Chitungwiza.', words: ['about', 'about us', 'who are you', 'what is pedyo', 'story', 'mission'] },
  { path: '/contact.html', title: 'Contact', icon: 'mail', hint: 'Message the Pedyo team, and a separate form for bug reports and feature requests to the developers.', words: ['contact', 'contact us', 'contact page', 'talk to someone', 'reach you', 'support', 'help desk', 'feedback', 'developer', 'developers', 'bug', 'report a bug', 'email you', 'phone number'] },
  { path: '/providers.html', title: 'My Provider Profiles', icon: 'building-2', hint: 'The listings on your account and their approval status. Sign in first.', words: ['my listing', 'my listings', 'my profile as provider', 'manage listings', 'my business', 'my provider profile', 'approval status'] },
  { path: '/verification.html', title: 'Verification', icon: 'shield-check', hint: 'Upload an ID document for a listing and track the identity check that earns the verified badge. Sign in first.', words: ['verification', 'verified', 'verify', 'identity', 'document', 'id document', 'id card', 'badge', 'proof'] },
  { path: '/messages.html', title: 'Messages', icon: 'message-circle', hint: 'Your inbox as a customer — the threads with providers. Sign in first.', words: ['message', 'messages', 'inbox', 'chat', 'conversation', 'my threads'] },
  { path: '/provider-messages.html', title: 'Provider Inbox', icon: 'inbox', hint: 'The inbox for a listing: enquiries and conversations from customers. Sign in first.', words: ['provider inbox', 'provider messages', 'customer requests', 'enquiries', 'leads'] },
  { path: '/settings.html', title: 'Settings', icon: 'settings', hint: 'Account settings: name, email, password and notification preferences. Sign in first.', words: ['settings', 'password', 'change password', 'change email', 'account settings', 'notification', 'delete my account', 'two factor'] },
  { path: '/account/profile.html', title: 'My Profile', icon: 'user', hint: 'Your own profile: the photo and details shown to providers. Sign in first.', words: ['my profile', 'edit profile', 'profile picture', 'avatar', 'change photo', 'my account'] },
  { path: '/account/become-provider.html', title: 'Become a Provider', icon: 'briefcase', hint: 'Apply to list your own services on Pedyo, then wait for an admin to approve it.', words: ['become a provider', 'becoming a provider', 'list my services', 'sell my services', 'register my business', 'join as provider', 'get listed', 'offer my services', 'apply as a provider', 'want to list'] },
  { path: '/account/register.html', title: 'Create Account', icon: 'plus', hint: 'Sign up for a Pedyo account with an email and password.', words: ['sign up', 'signup', 'register', 'create account', 'join', 'new account'] },
  { path: '/account/login.html', title: 'Sign In', icon: 'lock', hint: 'Log in to an existing Pedyo account.', words: ['login', 'log in', 'sign in', 'signin', 'password reset link'] },
  { path: '/account/forgot-password.html', title: 'Forgot Password', icon: 'lock', hint: 'Send a reset link to the email on the account.', words: ['forgot password', 'reset', 'reset password', 'cannot log in', 'locked out'] },
  { path: '/legal/terms.html', title: 'Terms of Use', icon: 'book-open', hint: 'The rules for using Pedyo, for customers and providers.', words: ['terms', 'terms of use', 'conditions', 'agreement'] },
  { path: '/legal/privacy.html', title: 'Privacy Policy', icon: 'lock', hint: 'What Pedyo stores about you, why, and how to ask for it to be removed.', words: ['privacy', 'privacy policy', 'personal data', 'data', 'gdpr', 'cookies'] },
  { path: '/legal/safety.html', title: 'Safety Guidelines', icon: 'badge-check', hint: 'How to meet a provider safely and how to spot a listing that is wrong.', words: ['safety', 'safe', 'scam', 'fraud', 'is it safe', 'trust', 'warning'] },
];

// One page per service category, added to the list above with the same shape.
const CATEGORY_PAGES = [
  ['solar-water', 'Solar, Inverters & Water', 'sun', 'solar', 'inverter', 'geyser', 'water tank', 'pump'],
  ['plumbing', 'Plumbing', 'wrench', 'plumber', 'plumbing', 'leak', 'drain', 'toilet', 'tap'],
  ['electrical', 'Electrical', 'zap', 'electrician', 'electrical', 'wiring', 'rewiring', 'power'],
  ['transport', 'Transport & Delivery', 'truck', 'driver', 'transport', 'delivery', 'moving', 'run'],
  ['construction', 'Construction & Repairs', 'hard-hat', 'builder', 'construction', 'repair', 'renovation', 'brick'],
  ['cleaning', 'Cleaning & Property Care', 'spray-can', 'cleaner', 'cleaning', 'maid', 'laundry', 'carpet'],
  ['automotive', 'Automotive', 'car', 'mechanic', 'car', 'vehicle', 'tyre', 'battery'],
  ['events', 'Events', 'party-popper', 'event', 'wedding', 'catering', 'dj', 'decor'],
  ['education', 'Education & Tutoring', 'book-open', 'tutor', 'teacher', 'lessons', 'homework', 'exam'],
  ['digital', 'Digital & Business Services', 'laptop', 'digital', 'designer', 'computer', 'website', 'social media', 'photo'],
  ['appliance', 'Appliance Repair', 'plug', 'fridge', 'appliance', 'washing machine', 'microwave', 'boiler'],
  ['property', 'Property Care', 'house', 'gardener', 'property', 'lawn', 'pest', 'guard'],
];

for (const [file, name, icon, ...extra] of CATEGORY_PAGES) {
  SITE_PAGES.push({
    path: `/services/${file}.html`,
    title: name,
    icon,
    hint: `Every approved listing in ${name}, with ratings and coverage areas.`,
    // "page" is not a keyword here: the concierge answers a trade question with
    // listings, and only falls through to this page when nothing matches.
    words: [name.toLowerCase(), ...extra],
    category: true
  });
}

// A question is a request for a page when it uses one of these. Without it,
// "I need a plumber" would match the Plumbing page and never reach a listing.
const WAYFINDING = [
  'page', 'link', 'website', 'url', 'address of', 'take me', 'go to', 'open the',
  'where is', 'where are', 'where can i', 'where do i', 'how do i', 'which page', 'show me',
  'is there a', 'are there any', 'do you have', 'can i see', 'can i get',
  'i am looking for the', "i'm looking for the", 'contact us',
];

// Groq metered accounts are capped on tokens per minute, and a question goes to
// the model once per visitor turn, so the panel forwards 16 pages rather than
// the whole catalog. The proxy caps the dump again at MAX_PAGES.
const SEND_TO_MODEL = 16;

function normalise(text) {
  const t = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return { t, tokens: t.trim().split(' ') };
}

// Whole words only, so "with" cannot match the keyword "it". A single-word
// keyword still opens a token, which is how "plumber" catches "plumbers".
function isHit(word, { t, tokens }) {
  return word.includes(' ')
    ? t.includes(` ${word} `)
    : tokens.some(tok => tok.startsWith(word));
}

// Best match first. Pages the question does not mention keep catalog order,
// which leaves Home, Services and Contact at the front of the leftovers.
function rankPages(text) {
  const n = normalise(text);
  return SITE_PAGES
    .map(p => ({ p, s: p.words.reduce((acc, w) => acc + (isHit(w, n) ? 1 : 0), 0) }))
    .sort((a, b) => b.s - a.s);
}

// The shortlist the model is allowed to link from, in the shape it sees.
export function pagesForModel(text, limit = SEND_TO_MODEL) {
  return rankPages(text).slice(0, limit).map(({ p }) => ({
    path: p.path,
    title: p.title,
    hint: p.hint.slice(0, 110)
  }));
}

export function pageByPath(path) {
  return SITE_PAGES.find(p => p.path === path);
}

// Returns the pages a message is asking for, or nothing when the message is a
// job rather than a request for a page.
export function requestedPages(text) {
  const { t } = normalise(text);
  if (!WAYFINDING.some(cue => t.includes(cue))) return [];
  const ranked = rankPages(text).filter(x => x.s > 0);
  const notACategory = ranked.filter(x => !x.p.category);
  // A trade question goes to the concierge so it can answer with real listings;
  // the category page only wins when it is what the visitor actually named.
  return (notACategory.length ? notACategory : ranked).slice(0, 2).map(x => x.p);
}
