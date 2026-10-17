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
- **Cloudflare Pages** for hosting (`_headers` and `_redirects` at the root).

## Layout

```
/                       public pages (index, search, provider, services, about, contact)
/account/               auth, profile, become-a-provider, settings
/admin/                 moderation queue: providers, images, docs, reports, reviews, categories, users
/messages.html          customer inbox
/provider-messages.html provider inbox
/assets/css/            reset → tokens → components → layout → pages (load order matters)
/assets/js/             ES modules: supabase-client, auth, providers, conversations, reviews, storage, admin
/supabase/schema.sql    tables, RLS, triggers, grants, storage buckets
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

## Deploying

Cloudflare Pages, framework preset **None**, build command empty, output
directory the repo root. No environment variables are required — the publishable
key is already in the client. Add the Pages project's domain to the Supabase
Auth callback allow-list if you enable email links.
