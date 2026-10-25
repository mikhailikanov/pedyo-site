# Pedyo

A local-services marketplace for Harare and Chitungwiza, Zimbabwe. *Pedyo* means
"close" or "nearby" in Shona — the product is finding a plumber, electrician or
solar installer who is actually nearby and actually verified.

Customers browse 12 service categories without an account. Providers claim a
profile, list services and coverage areas, upload work photos, and get approved
by an admin before going public. Both sides can message in-app.

## Stack

- **Static, no build step.** 43 HTML pages plus ES modules loaded straight from
  the repo. Absolute `/assets/...` paths, no bundler, no framework.
- **Supabase** — Postgres with row-level security, Storage for images, and
  Realtime for messaging. The client is `supabase-js` v2 imported from jsDelivr
  as an ESM module, so there is no `node_modules` in the deployed site.
- **Cloudflare Pages** for hosting (`_headers` and `_redirects` at the root), with
  one **Pages Function** in `functions/` proxying the AI concierge to Groq.

## Layout

```
/                       public pages (index, search, provider, services, about, contact)
/account/               auth, profile, become-a-provider, settings
/admin/                 moderation queue: providers, images, docs, reports, reviews, blocked words, categories, users
/messages.html          customer side of the account
/provider-messages.html provider side of the same account
/functions/ai-chat.js   the concierge proxy — the only server-side code in the repo
/assets/css/            reset → tokens → components → layout → pages (load order matters)
/assets/js/             ES modules: supabase-client, auth, identity, nav, assistant, site-pages,
                        providers, reviews, conversations, storage, notify, icons, ui, admin
/supabase/schema.sql    tables, RLS, triggers, grants, storage buckets, scheduled moderation
/supabase/seed.sql      demo categories, providers, services, areas, reviews
```

## Running locally

Any static server works, but the site uses root-absolute paths, so it must be
served from the domain root:

```
npx serve .          # or: python -m http.server 8080
```

Open `http://localhost:8080`. The publishable key in
`assets/js/supabase-client.js` points at the live demo project, so data loads
without any local backend.

## Setting up your own Supabase project

1. Create a project and copy its URL and **publishable** anon key into
   `assets/js/supabase-client.js`.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
   Both are idempotent — re-running them is safe and will not duplicate rows.
3. Under Authentication → Providers, either enable "Confirm email" (the signup
   flow expects it) or disable it for local testing.
4. If you want the scheduled review moderator, give it a separate Groq key and put
   it in the database vault, where only the `postgres` role can read it:

   ```sql
   select vault.create_secret('gsk_…', 'pedyo_groq_moderation_key',
          'Groq key used only by the scheduled review moderator');
   ```

   Without it nothing breaks: every pass is recorded as
   `failed — no moderation key in the vault` and the reviews stay visible.

Never put a `service_role` or `sb_secret_...` key in this repo. Everything the
browser does is meant to be reachable under the RLS policies below.

## Demo data

`seed.sql` creates 12 categories, 37 approved providers plus one pending profile
in the admin queue, ~108 services, ~148 coverage areas and 88 reviews, so every
category has at least three rated businesses. It also inserts a contact message
into the reports table.

The demo accounts are **data, not logins** — their `auth.users` rows get random
unusable passwords. Do not run this seed against anything real.

`seed.sql` also creates a placeholder `admin@pedyo.local` profile so the admin queue has
something to point at. It is **not** a login: Supabase rejects reserved TLDs at signup, and
hashes written straight into `auth.users` are not accepted by GoTrue even when bcrypt says
they match. To reach the admin pages, register a normal account at
`/account/register.html`, then promote it:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

That statement has to run from the SQL editor or a direct connection. `is_admin`, the
`status`/`identity_reviewed`-style review columns and image `moderation_status` are frozen by
triggers for anyone connecting as the `authenticated` role, because the owner-scoped policies
otherwise let a signed-in provider promote themselves or approve their own listing.

Two Auth settings matter here. **Confirm email is switched off** in Sign In / Providers,
because Supabase's built-in test mailer caps out at roughly two emails an hour and answers
with `over_email_send_rate_limit`; add your own SMTP credentials before turning it back on.
And create any account you need to sign in as through the signup form or Auth's admin API,
never with a raw `insert into auth.users`.

Change that placeholder address before deploying anywhere real.

## How the backend is shaped

Things that are not obvious from the code and are easy to break:

- **Ratings are denormalised.** `provider_profiles.rating_avg` and `review_count`
  are maintained by triggers on `reviews`. Nothing computes them at read time, so
  "Top rated" sorting is a plain `order()` and stays correct as reviews land.
- **Search is one column.** `provider_profiles.search_text` is built by a trigger
  from the business name, description, category, service names and coverage
  areas. PostgREST cannot mix an embedded column and a top-level column inside a
  single `or=(...)` filter, so a live multi-field `or=` search would silently
  break — this is why the field is flattened instead.
- **`provider_services` is written, not just read.** Every browse page filters on
  it. `unique (provider_profile_id, service_name)` and the matching constraint on
  `service_areas` are what make the seed's `on conflict do nothing` actually work.
- **Inboxes route through `conversation_members`.** `inbox_type` and
  `unread_count` live on the membership row, not the conversation, and
  `conversations` has two foreign keys to `profiles`, so embeds must be pinned
  with `profiles!conversations_customer_id_fkey(...)` / `..._provider_id_fkey(...)`.
- **Gallery photos are moderated.** `provider_images.moderation_status` gates
  public reads, and `profiles.email` is hidden from `anon` by column-level grants
  rather than a policy.
- **RLS policies are permissive and therefore OR-ed.** Adding a broad read policy
  re-widens access for everyone; the moderation gates depend on that not happening.
- **Two avatar keys, one storage policy.** `assets/js/storage.js` writes a person to
  `avatars/<uid>/avatar.jpg` and a listing to `avatars/<uid>/providers/<listing id>/avatar.jpg`.
  The uid sits at `storage.foldername(name)[2]` in both shapes, so the `profiles` bucket's
  owner-write policy covers listing logos without being widened. Change one key without the
  other and every upload fails with "new row violates row-level security policy". The URL
  that is stored carries `?v=<timestamp>` because the key never changes, so a CDN holding the
  old picture is otherwise refreshed only when its cache expires.
- **A face and a logo are separate columns.** `profiles.avatar_url`/`avatar_path` describe the
  person, `provider_profiles.avatar_url`/`avatar_path` describe the listing, so one account that
  has both can carry two different pictures. Every surface that presents a business — the nav
  bubble in provider mode, the browse and search cards, the listing page, the inbox, the
  concierge's pick card — reads the listing avatar and falls back to the business initials,
  never to the owner's face.
- **The crop is baked before the file leaves the page.** `assets/js/crop.js` lets the user pan,
  zoom and resize the region, then redraws that region onto a square canvas, so the server only
  ever receives a finished JPEG and no crop coordinates are stored anywhere. Cancelling the
  modal resolves `null` and the caller returns before touching storage.
- **Notifications are generated server-side.** A trigger on `messages` fans rows
  out into `notifications` for every member except the sender. The client never
  inserts them; `assets/js/notify.js` only decides whether a granted browser
  alert is shown for a row that arrives.
- **The nav badge counts membership rows, never `notifications`.** One account
  sits on both sides of different threads, and a notifications row does not say
  which side it landed on, so counting them puts a provider's unread mail on the
  customer page. `unreadMessages()` sums `conversation_members.unread_count`
  where `inbox_type` matches the inbox being viewed.
- **Browsing as a listing is a shell state, not a session.** `assets/js/identity.js`
  keeps the mode and the active listing in `localStorage`, and everything that
  depends on it (the inbox link, the account menu, the nav links, the badge) is
  read from there. An inbox page pins the mode *before* `renderNav()`, because
  the nav template paints synchronously and cannot wait for the listings query.
- **Inserting a conversation must not ask for the row back.** `conversations` is
  read through `is_conversation_member(id)`, which a brand-new row cannot satisfy
  yet, so `insert().select()` fails with a row-level-security error. Insert, then
  look the id up — which is what `startConversation()` does.
- **One reports queue, four kinds of entry.** `reports.target_type` is `review`,
  `provider`, `contact` or `developer`. The public pages write all four and read
  none; `admin/reports.html` lists whatever is `open` and prints the type as a
  badge, so a new kind needs the check constraint and nothing else. `developer`
  comes from the "Contact the developers" block on `/contact.html`, which is the
  one place a visitor can reach the people building the site rather than the
  support queue.

## Provider concierge

A chat dock in the bottom-right corner of every public page (`assets/js/assistant.js`,
mounted from `initNav()` so no page has to carry the markup). It answers "who can fix a
leaking geyser in Borrowdale?" with real listings, not prose, and "is there a contact us
page?" with a link to that page.

- **The key never reaches the browser.** The panel POSTs to `/ai-chat`;
  `functions/ai-chat.js` holds `GROQ_API_KEY` as a Pages environment binding and makes the
  Groq call server-side. Locally `npx wrangler pages dev .` runs the same module alongside the
  static files; a plain static server has no `/ai-chat`, and the panel then honestly reports
  that the concierge is not connected.
- **It cannot invent a business.** The prompt is closed-world: the model only sees the
  approved listings the browser found in Supabase (`searchProviders`, `status='approved'`,
  best-rated first, cached for the tab) and replies with `{reply, picks:[slug], links:[path]}`.
  Every slug is checked back against that list, and the panel builds links by looking the slug
  up in its own pool, so an unknown slug renders nothing.
- **It knows the site's own pages.** `assets/js/site-pages.js` is a hard-coded catalog —
  every core page plus one entry per `/services/<category>.html` file that exists. Asking for a
  page ("where do I reset my password", "take me to the about page") is answered on the spot
  from that catalog, without a Groq call, so it also works when the proxy is down. Everything
  else travels the same closed-world route as listings: the browser sends a shortlist of the
  pages the customer's words point at as `body.pages`, the model may answer with `links`, and a
  path is kept only if the client sent it — twice checked, in the proxy and again in the panel.
  The catalog is hard-coded so an admin adding a thirteenth category cannot make the concierge
  link to a 404.
- **A trade question is still a trade question.** Matching the catalog is gated on wayfinding
  words ("where is", "is there a page", "take me to"), and a category match alone falls
  through, so "where can I find a plumber" answers with listings rather than the Plumbing page.
- **Nothing to recommend is a real answer.** With few or no approved listings the concierge
  says so and links the Services page rather than guessing — the same holds for a job no
  listing covers.
- **Costs are bounded by prompt size.** Groq metered accounts are capped on tokens per
  minute and every candidate costs prompt tokens, so the browser forwards a 12-listing
  shortlist ranked by the customer's own words, a 16-page shortlist ranked the same way, and
  the proxy caps both dumps at `MAX_CANDIDATES` / `MAX_PAGES`. The proxy logs total tokens, so
  the headroom is visible before raising either cap. A 429 from Groq is returned as 429, which
  the panel reports as "busy, try again in a few seconds" instead of a broken assistant.
- **Retired model ids are the usual outage.** `llama-3.3-70b-versatile` no longer resolves
  on this account; the working ids at time of writing are `openai/gpt-oss-120b` (default),
  `openai/gpt-oss-20b` and `qwen/qwen3.8-27b`. Override without a code change with the
  `GROQ_MODEL` binding, and check `GET /openai/v1/models` when it starts answering 502.
- Chat history lives in `sessionStorage`, so clicking through to a listing or a page and back
  keeps the conversation. The six starter chips, the "start over" button and `Esc` all behave
  as labelled. It is deliberately absent from `/admin/` and from the five auth pages, which do
  not call `initNav()`.
- The launcher is parked above the bottom edge and can be dragged or arrow-keyed anywhere on
  screen; the spot is remembered in `localStorage` under `pedyo_dock_pos`. It floats, so
  without that clearance it covers the message composer's Send button on `/messages.html`.

## Content protection

Text a user writes is masked **in Postgres**, never in the browser. This is a no-build
static client over PostgREST, so a filter that ran in `assets/js/` could be skipped by
hand-crafting the same POST.

- `blocked_terms` holds the word list, tagged `en` or `sn` (Shona). Admins edit it at
  `/admin/terms.html`; the list itself is readable by admins only, because publishing it
  would only teach people what to spell around.
- `censor_text()` masks each match on word boundaries (`\y`, so "ass" never breaks "class"),
  keeping the first letter and the shape of the word. A per-table `censor_*()` trigger runs
  it over `messages.content`, `reviews.content`, `profiles.bio`,
  `provider_profiles.description` and `provider_services.service_name`, and sets
  `censored = true` when anything changed. Every page already reads those columns, so
  masking reaches the whole site without a single display change.
- Only chat keeps the raw text, in `messages.original_content`. The reader of a masked
  message sees a quiet "Show message" toggle; the writer always sees what they sent.
  Reviews, bios and listings keep no readable copy.
- `profiles.blocked` stops an account outright: `guard_blocked_writer()` refuses their
  inserts on messages, reviews, conversations and listings, the storage policies refuse
  their uploads, and `guard_profiles_privileges()` stops them lifting their own block.
  Admins toggle it from the Access column on `/admin/users.html`.
- Existing rows are not rewritten — the triggers fire on new writes, so old text keeps
  whatever it had.
- Every masking rule lives in `supabase/schema.sql`; applying it to a project is
  `node _tools/run-sql.mjs <file.sql>`, not a deploy.

## Review moderation

The word filter catches a vulgar word; it cannot catch a review that is politely abusive.
A model reads those, and it runs **inside Postgres** on a schedule, so there is no worker
to deploy, no cron service to pay for and no API key in the browser.

- Two `pg_cron` jobs, because `pg_net` is asynchronous: a request queued inside a
  transaction only leaves once that transaction commits. So one pass is two jobs —
  `pedyo-moderation-submit` (`*/30 * * * *`) sends the oldest 25 unchecked reviews to Groq,
  `pedyo-moderation-collect` (`* * * * *`) reads whichever answers have landed by then.
- The moderator has **its own Groq key**, stored in `vault.decrypted_secrets` as
  `pedyo_groq_moderation_key` and read only by `moderation_submit()`. It is not the
  concierge key, it is not in this repo, and `anon` cannot query the vault.
- `moderation_prompt()` is the rubric. Hide personal attacks and slurs, sexual content,
  somebody's private details, advertising, threats — and explicitly *do not* hide negative,
  angry, one-star or badly spelled criticism. A bad review is not a moderation problem.
- A verdict is stored on the review (`moderation_status`, `moderation_category`,
  `moderation_note`, `moderated_at`), and hiding one moves the listing's `rating_avg` and
  `review_count` on its own, because `on_review_change` counts only `hidden = false` rows.
- **The machine can hide, never reveal.** `moderation_collect()` writes
  `hidden = hidden or harm`, so it cannot undo a decision an admin made. `restore_review()`
  is the human override: it unhides, marks the review clean and records `review.restore`.
  Auto-hides are audited under the nil UUID as `review.auto_hide`, with the model name,
  category and its one-line reason in `meta`.
- It fails safe. Only a parsed verdict hides anything: an outage, a 429, an answer that is
  prose instead of JSON, or one that never arrives leaves the reviews `unchecked` and
  visible, recorded as `failed` or `timeout` in `moderation_pass` — one row per call, which
  is the audit trail for the automation itself. Unanswered reviews are just sent again.
- Editing a review returns it to `unchecked` (`review_recheck`): a verdict belongs to the
  words that were there when it was given.
- Admins see all of it at `/admin/reviews.html`: per-review check result and reason, the
  Not checked / Flagged / Hidden filters, the last pass summary, **Check new reviews now**
  (`moderation_run_now`) and **Restore** (`restore_review`). Those two check `is_admin()`
  inside the function, and every other piece of the pipeline is revoked from `anon` and
  `authenticated`. PostgREST only serves the `public` schema, so `net`, `cron` and `vault`
  are not reachable from the client at all.
- One pass is bounded: 25 reviews (hard cap 40), 300 characters of each, 1500 tokens back.
- To look at it: `select status, return_message from cron.job_run_details order by
  start_time desc limit 20;` and `select * from moderation_pass order by id desc limit 5;`.
  Changing any of it goes through `node _tools/run-sql.mjs <file.sql>`, not a deploy.

## Icons

Emoji are not used as interface icons anywhere. `assets/js/icons.js` holds 58
inline SVG path sets vendored from [lucide-static](https://www.npmjs.com/package/lucide-static)
(ISC), and `icon(name, { size, cls, stroke })` returns markup that inherits
`currentColor`, so icons take the colour of the text around them. The file is
generated from the Lucide bundle rather than hand-maintained: add a name to its
`PATHS` map (copy the inner nodes of that icon's `<svg>` from the package) and it
works everywhere `icon()` is called. Filled glyphs, like the rating stars, take
`cls: 'icon-filled'`.

## Deploying

Cloudflare Pages, framework preset **None**, build command empty, output
directory the repo root. `functions/ai-chat.js` is picked up automatically.

The site works without any configuration except the concierge, which needs one
secret and takes one optional variable (Pages project → Settings → Functions →
Environment variables — the secret is not stored in this repo and is not
deployed with the static files):

```
GROQ_API_KEY   (secret)        gsk_…  from console.groq.com/keys
GROQ_MODEL     (plain variable) openai/gpt-oss-120b
```

Without `GROQ_API_KEY` the endpoint answers `503 not_configured` and the panel
says it is not connected yet; every other feature is unaffected. A secret saved
*after* a build is not injected into that build, so the first one needs a retry
from Deployments → Actions → Retry deployment (or any later push). Add the Pages
project's domain to the Supabase Auth callback allow-list if you enable email
links.
