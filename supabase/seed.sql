-- ============================================================
-- Pedyo — demo seed data
-- Run AFTER schema.sql. Requires the schema's handle_new_user
-- trigger, which creates a profiles row for every auth.users row.
--
-- Everything here is fictional demo content so the marketplace is
-- not an empty shell on first load. Delete with:
--   delete from public.provider_profiles where slug like 'demo-%';
--
-- The seeded auth.users rows have random unusable passwords. They
-- are data, not logins. Do not use this file against production.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. The 12 service categories.
--    Names are load-bearing: provider_services.category and
--    provider_profiles.primary_category are matched against them
--    by string, and assets/js/categories.js mirrors this list.
-- ------------------------------------------------------------

insert into public.service_categories (id, name, sort_order, is_active) values
  (1,  'Solar, Inverters & Water',        1,  true),
  (2,  'Plumbing',                        2,  true),
  (3,  'Electrical',                      3,  true),
  (4,  'Transport & Delivery',            4,  true),
  (5,  'Construction & Repairs',          5,  true),
  (6,  'Cleaning & Property Care',        6,  true),
  (7,  'Automotive',                      7,  true),
  (8,  'Events',                          8,  true),
  (9,  'Education & Tutoring',            9,  true),
  (10, 'Digital & Business Services',    10,  true),
  (11, 'Appliance Repair',               11,  true),
  (12, 'Property Care',                  12,  true)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Identity was seeded explicitly, so advance the sequence past it
-- or the admin "add category" button will collide on id 13.
select setval(
  pg_get_serial_sequence('public.service_categories', 'id'),
  (select max(id) from public.service_categories),
  true
);

-- ------------------------------------------------------------
-- 2. Demo accounts.
--    handle_new_user builds the profiles row from these, so
--    full_name and email land in place automatically.
-- ------------------------------------------------------------

create temporary table if not exists demo_owner (
  ordinal   int primary key,
  full_name text,
  email     text,
  phone     text,
  uid       uuid
) on commit drop;

insert into demo_owner (ordinal, full_name, email, phone, uid) values
  (1, 'Tapiwa Moyo',      'tapiwa.moyo@example.co.zw',    '+263771234501', 'a1111111-1111-4111-8111-111111111101'),
  (2, 'Rutendo Chikafu',  'rutendo.chikafu@example.co.zw','+263771234502', 'a1111111-1111-4111-8111-111111111102'),
  (3, 'Nkosana Dube',     'nkosana.dube@example.co.zw',   '+263771234503', 'a1111111-1111-4111-8111-111111111103'),
  (4, 'Farai Nyathi',     'farai.nyathi@example.co.zw',   '+263771234504', 'a1111111-1111-4111-8111-111111111104'),
  (5, 'Blessing Sibanda', 'blessing.sibanda@example.co.zw','+263771234505','a1111111-1111-4111-8111-111111111105'),
  (6, 'Yeukai Marufu',    'yeukai.marufu@example.co.zw',  '+263771234506', 'a1111111-1111-4111-8111-111111111106'),
  (7, 'Simba Ncube',      'simba.ncube@example.co.zw',    '+263771234507', 'a1111111-1111-4111-8111-111111111107'),
  (8, 'Anesu Gumbo',      'anesu.gumbo@example.co.zw',    '+263771234508', 'a1111111-1111-4111-8111-111111111108');

-- A second tranche so no category is represented by a single business.
insert into demo_owner (ordinal, full_name, email, phone, uid) values
  (9,  'Takunda Mhungu',     'takunda.mhungu@example.co.zw',     '+263771234509', 'a1111111-1111-4111-8111-111111111109'),
  (10, 'Rumbidzai Chiremba', 'rumbidzai.chiremba@example.co.zw', '+263771234510', 'a1111111-1111-4111-8111-111111111110'),
  (11, 'Knowledge Matiza',   'knowledge.matiza@example.co.zw',   '+263771234511', 'a1111111-1111-4111-8111-111111111111'),
  (12, 'Tendai Gwanda',      'tendai.gwanda@example.co.zw',      '+263771234512', 'a1111111-1111-4111-8111-111111111112'),
  (13, 'Patience Mavhunga',  'patience.mavhunga@example.co.zw',  '+263771234513', 'a1111111-1111-4111-8111-111111111113'),
  (14, 'Osias Hashim',       'osias.hashim@example.co.zw',       '+263771234514', 'a1111111-1111-4111-8111-111111111114'),
  (15, 'Nyasha Chikore',     'nyasha.chikore@example.co.zw',     '+263771234515', 'a1111111-1111-4111-8111-111111111115'),
  (16, 'Delight Makoni',     'delight.makoni@example.co.zw',     '+263771234516', 'a1111111-1111-4111-8111-111111111116'),
  (17, 'Arnold Bvumbwe',     'arnold.bvumbwe@example.co.zw',     '+263771234517', 'a1111111-1111-4111-8111-111111111117'),
  (18, 'Memory Chipato',     'memory.chipato@example.co.zw',     '+263771234518', 'a1111111-1111-4111-8111-111111111118'),
  (19, 'Prisca Mhangura',    'prisca.mhangura@example.co.zw',    '+263771234519', 'a1111111-1111-4111-8111-111111111119'),
  (20, 'Goodman Zvorwadza',  'goodman.zvorwadza@example.co.zw',  '+263771234520', 'a1111111-1111-4111-8111-111111111120');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, phone
)
select
  o.uid, 'authenticated', 'authenticated', o.email,
  encode(gen_random_bytes(32), 'base64') || '#demodisabled',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', o.full_name),
  now() - (o.ordinal || ' days')::interval, now(),
  '', '', o.phone
from demo_owner o
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. Provider businesses.
-- ------------------------------------------------------------

create temporary table if not exists demo_provider (
  ordinal        int primary key,
  owner_ordinal  int references demo_owner(ordinal),
  slug           text,
  business_name  text,
  provider_type  text,
  category       text,
  description    text,
  areas          text[],
  whatsapp       text,
  availability   text,
  email_ok       boolean,
  contact_ok     boolean,
  identity_ok    boolean,
  docs_ok        boolean,
  founding       boolean,
  created_offset integer
) on commit drop;

insert into demo_provider (
  ordinal, owner_ordinal, slug, business_name, provider_type, category, description,
  areas, whatsapp, availability,
  email_ok, contact_ok, identity_ok, docs_ok, founding, created_offset
) values
(1, 1, 'demo-mshai-solar',        'Mshai Solar & Water',        'business',   'Solar, Inverters & Water',
 'Solar arrays, inverters and borehole pumps sized for load-shedding schedules. Free site assessment and a written install plan before any work starts.',
 array['Harare','Msasa','Avondale','Mount Pleasant','Chitungwiza'],
 '+263771234501', 'Mon-Sat, 07:30-17:00', true, true, true, true, true, 240),

(2, 1, 'demo-mshai-electrical',   'Mshai Electrical Works',     'business',   'Electrical',
 'Registered electrical contractors doing COCs, DB board upgrades and industrial wiring. Every job leaves a certificate and a labelled board.',
 array['Harare','Msasa','Belgravia','Avondale'],
 '+263771234501', 'Weekdays, 08:00-17:00', true, true, true, false, false, 200),

(3, 2, 'demo-chikafu-plumbing',   'Chikafu Plumbing Solutions', 'individual', 'Plumbing',
 'Twenty years on the job across Highfield and Glen View. Geysers, burst pipes, toilet and kitchen installations, plus drain clearing.',
 array['Highfield','Glen View','Budiriro','Cobark','Chitungwiza'],
 '+263771234502', 'Mon-Sun, 07:00-19:00', true, true, true, false, true, 300),

(4, 3, 'demo-dube-transport',     'Dube Runabout Delivery',     'business',   'Transport & Delivery',
 'One-tonne bakkie and a 14-seater. Same-day town deliveries, furniture moves and airport transfers with a tracked driver.',
 array['Harare CBD','Chitungwiza','Ruwa','Epworth','Harare Airport'],
 '+263771234503', 'Daily, 06:00-20:00', true, true, false, false, false, 150),

(5, 4, 'demo-nyathi-build',       'Nyathi Build & Repairs',     'business',   'Construction & Repairs',
 'Small civils and general building: roof repairs, plastering, paving and bathroom renovations. Named site supervisor on every project.',
 array['Harare','Chitungwiza','Norton','Seke'],
 '+263771234504', 'Mon-Fri, 07:00-17:00', true, true, true, true, false, 210),

(6, 4, 'demo-nyathi-paint',       'Nyathi Painting Division',   'individual', 'Construction & Repairs',
 'Interior and exterior painting with prep included. Two-coat finish and a clean site at handover.',
 array['Harare','Mount Pleasant','Borrowdale','Waterfalls'],
 '+263771234504', 'Mon-Sat, 08:00-16:30', true, false, false, false, false, 90),

(7, 5, 'demo-sibanda-clean',      'Sibanda Sparkle Cleaning',   'business',   'Cleaning & Property Care',
 'End-of-lease deep cleans, office contracts and solar panel washing. Crews arrive with their own equipment and water.',
 array['Harare CBD','Avondale','Borrowdale','Greendale','Chitungwiza'],
 '+263771234505', 'Mon-Sat, 06:30-17:00', true, true, true, true, true, 330),

(8, 5, 'demo-sibanda-garden',     'Sibanda Garden Care',        'individual', 'Property Care',
 'Turf, hedge and tree work. Weekly and fortnightly maintenance plans for section-home complexes.',
 array['Chitungwiza','Highfield','Glen View','Ruwa'],
 '+263771234505', 'Mon-Fri, 07:00-16:00', true, true, false, false, false, 120),

(9, 6, 'demo-marufu-auto',        'Marufu Auto Electrics',      'individual', 'Automotive',
 'Diagnostics, alternators, starters and wiring loom repairs. Mobile call-outs for cars that will not start.',
 array['Harare CBD','Southerton','Graniteside','Chitungwiza'],
 '+263771234506', 'Mon-Sat, 08:00-17:30', true, true, true, false, false, 180),

(10, 6, 'demo-marufu-tyres',      'Marufu Tyre & Battery',      'business',   'Automotive',
 'Tyres, batteries and fitting at the roadside. Stock carried for most saloon and light-commercial sizes.',
 array['Harare','Chitungwiza','Epworth'],
 '+263771234506', 'Daily, 07:30-18:00', true, false, false, false, false, 60),

(11, 7, 'demo-ncube-events',      'Ncube Events & Sound',       'business',   'Events',
 'PA systems, lighting and staging for weddings, funerals and corporate functions. Generator included so the sound never drops.',
 array['Harare','Chitungwiza','Norton','Marondera'],
 '+263771234507', 'Mon-Sun, by booking', true, true, true, true, false, 260),

(12, 7, 'demo-ncube-catering',    'Ncube Kitchen Catering',     'individual', 'Events',
 'Home-style catering for 20 to 300 guests. Menus agreed in writing and delivered hot.',
 array['Harare','Chitungwiza','Ruwa'],
 '+263771234507', 'By booking, 48 hours notice', true, true, false, false, false, 75),

(13, 8, 'demo-gumbo-tutor',       'Gumbo Maths & Science Tutoring', 'individual', 'Education & Tutoring',
 'O-level and A-level maths, further maths and physics. Small groups at the library or one-to-one at home.',
 array['Chitungwiza','Highfield','Glen View','Harare'],
 '+263771234508', 'Weekdays after 15:00, Sat mornings', true, true, true, false, true, 290),

(14, 8, 'demo-gumbo-digital',     'Gumbo Digital Studio',       'business',   'Digital & Business Services',
 'Websites, branding and bookkeeping setup for small businesses. WhatsApp-first support and no long contracts.',
 array['Harare','Remote'],
 '+263771234508', 'Mon-Fri, 09:00-17:00', true, true, true, true, false, 140),

(15, 2, 'demo-chikafu-appliance',  'Chikafu Appliance Repair',   'individual', 'Appliance Repair',
 'Fridges, washing machines, stoves and microwaves. Most repairs done in a single visit with parts carried on the van.',
 array['Harare','Chitungwiza','Highfield','Budiriro'],
 '+263771234502', 'Mon-Sat, 08:00-17:00', true, true, false, false, false, 100),

(16, 3, 'demo-dube-weld',         'Dube Welding & Gates',       'business',   'Construction & Repairs',
 'Gates, burglar bars, carports and steel structures. On-site welding for repairs that cannot leave the yard.',
 array['Chitungwiza','Harare','Seke','Kuwadzana'],
 '+263771234503', 'Mon-Fri, 07:30-17:00', true, true, true, false, false, 170),

-- ── Second tranche: brings every category to at least three providers ────────
(17, 9,  'demo-mhungu-power',      'Mhungu Power Systems',       'business',   'Solar, Inverters & Water',
 'Inverter and lithium backup for shops, clinics and section-home stands. Load audits done before sizing, not after.',
 array['Harare','Chitungwiza','Norton','Epworth'],
 '+263771234509', 'Mon-Fri, 08:00-17:00', true, true, true, true, false, 160),

(18, 11, 'demo-matiza-solar',      'Matiza Solar & Borehole',    'individual', 'Solar, Inverters & Water',
 'Borehole drilling, solar water heating and pump wiring. Twenty years on rigs before going out on his own.',
 array['Chitungwiza','Seke','Ruwa','Gedera'],
 '+263771234511', 'Mon-Sat, 07:00-16:30', true, true, false, false, false, 95),

(19, 10, 'demo-chiremba-drain',    'Chiremba Plumbing & Drainage','business',  'Plumbing',
 'Blocked drains, grease traps and external pipework. Jetting truck and CCTV inspection on the same call-out.',
 array['Harare CBD','Msasa','Hatfield','Chitungwiza','Budiriro'],
 '+263771234510', 'Mon-Sun, 06:30-18:00', true, true, true, true, false, 205),

(20, 12, 'demo-gwanda-taps',       'Gwanda Taps & Showers',      'individual', 'Plumbing',
 'Bathroom refits, leaking taps, cisterts and geyser servicing. Parts bought with you, not for you.',
 array['Highfield','Glen View','Mbare','Dzivarasekwa'],
 '+263771234512', 'Mon-Sat, 08:00-17:00', true, false, false, false, false, 55),

(21, 13, 'demo-mavhunga-electric', 'Mavhunga Electrical',        'individual', 'Electrical',
 'Domestic wiring, COCs, lighting and geysers. Same-week certificates with a ZERA-registered tradesman.',
 array['Avondale','Mount Pleasant','Borrowdale','Greendale'],
 '+263771234513', 'Mon-Fri, 07:30-16:30', true, true, true, false, false, 130),

(22, 14, 'demo-hashim-certs',      'Hashim Power & Certifications','business', 'Electrical',
 'Three-phase installs, DB upgrades and compliance for rentals and property sales. Reports issued with photo evidence.',
 array['Harare','Waterfalls','Belgravia','Arcturus'],
 '+263771234514', 'Mon-Fri, 08:30-17:00', true, true, true, true, false, 175),

(23, 15, 'demo-chikore-movers',    'Chikore Moving Crew',        'business',   'Transport & Delivery',
 'House and office moves with wrapping, carrying and reassembly. Two trucks so dates rarely slip.',
 array['Harare','Chitungwiza','Norton','Marondera','Airport'],
 '+263771234515', 'Mon-Sat, 06:00-18:00', true, true, true, true, false, 220),

(24, 16, 'demo-makoni-shuttle',    'Makoni Shuttle & Freight',   'business',   'Transport & Delivery',
 'Staff lifts, funeral transport and cross-town freight. Drivers vetted and every vehicle insured.',
 array['Harare CBD','Chitungwiza','Kuwadzana','Coppedge','Progressive'],
 '+263771234516', 'Daily, 05:30-20:00', true, true, false, false, false, 85),

(25, 17, 'demo-bvumbwe-bricks',    'Bvumbwe Bricklaying',        'individual', 'Construction & Repairs',
 'Walls, extensions, paving and curbs. Straight lines, square corners and a daily progress photo.',
 array['Chitungwiza','Seke','Stirling','Gedera'],
 '+263771234517', 'Mon-Fri, 07:00-17:00', true, true, false, false, false, 70),

(26, 18, 'demo-chipato-fresh',     'Chipato Fresh Cleaning',     'individual', 'Cleaning & Property Care',
 'Carpet, sofa and mattress steam cleaning plus one-off deep cleans. Drying time told to you upfront.',
 array['Harare','Msasa','Avondale','Chitungwiza'],
 '+263771234518', 'Mon-Sat, 08:00-16:00', true, true, false, false, false, 65),

(27, 19, 'demo-mhangura-office',   'Mhangura Office Care',       'business',   'Cleaning & Property Care',
 'Contract cleaning for offices, clinics and shops with night crews. Supplies and equipment included.',
 array['Harare CBD','Avenues','Belgravia','Borrowdale','Hatfield'],
 '+263771234519', 'Mon-Sun, night and weekend crews', true, true, true, true, true, 310),

(28, 20, 'demo-zvorwadza-body',    'Zvorwadza Panel & Paint',    'business',   'Automotive',
 'Accident repairs, denting and spray booth finishing. Written quote before any panel comes off.',
 array['Harare','Southerton','Graniteside','Industrial Area'],
 '+263771234520', 'Mon-Fri, 08:00-17:00', true, true, true, true, false, 190),

(29, 9,  'demo-mhungu-decor',      'Mhungu Event Decor',         'business',   'Events',
 'Centre pieces, table linen, backdrops and fresh flowers for weddings and showers. Set up and strike included.',
 array['Harare','Chitungwiza','Ruwa','Norton'],
 '+263771234509', 'Mon-Sun, by booking', true, true, false, false, false, 110),

(30, 10, 'demo-chiremba-english',  'Chiremba English & Debating','individual', 'Education & Tutoring',
 'Paper 1 and 2 coaching, comprehension and debate practice for O-level and form 1-4. Online or in person.',
 array['Harare','Avondale','Mount Pleasant','Remote'],
 '+263771234510', 'Weekdays 15:00-19:00, Sat', true, true, true, false, false, 145),

(31, 12, 'demo-gwanda-it',         'Gwanda Computer Skills',     'business',   'Education & Tutoring',
 'ECDL-style desktop packages, spreadsheet and accounting software classes for adults and small teams.',
 array['Chitungwiza','Highfield','Glen View'],
 '+263771234512', 'Mon-Fri, 09:00-16:00', true, false, false, false, false, 48),

(32, 13, 'demo-mavhunga-web',      'Mavhunga Web & Design',      'business',   'Digital & Business Services',
 'Fast static sites, Google Business setup and product catalogues. Hosting billed at cost, no lock-in.',
 array['Harare','Remote'],
 '+263771234513', 'Mon-Fri, 09:00-17:00', true, true, true, false, false, 135),

(33, 15, 'demo-chikore-ads',       'Chikore Social & Ads',       'individual', 'Digital & Business Services',
 'WhatsApp Business, Facebook and Instagram pages managed weekly, with ad spend reported honestly.',
 array['Harare','Chitungwiza','Remote'],
 '+263771234515', 'Mon-Sat, 10:00-18:00', true, true, false, false, false, 58),

(34, 16, 'demo-makoni-fridge',     'Makoni Fridge & Freezer',    'individual', 'Appliance Repair',
 'Regas, compressor swaps and sealed-system repairs for fridges, freezers and display cabinets.',
 array['Harare','Chitungwiza','Budiriro','Cobark'],
 '+263771234516', 'Mon-Sat, 08:00-17:30', true, true, true, false, false, 165),

(35, 14, 'demo-hashim-laundry',    'Hashim Laundry Repairs',     'business',   'Appliance Repair',
 'Washers, dryers and dishwashers — pumps, belts, boards and elements. Two-week warranty on parts fitted.',
 array['Harare','Avondale','Highlands','Chitungwiza'],
 '+263771234514', 'Mon-Fri, 08:30-17:00', true, true, false, false, false, 80),

(36, 17, 'demo-bvumbwe-grounds',   'Bvumbwe Grounds & Trees',    'business',   'Property Care',
 'Tree felling, stump grinding, brush clearing and lawn reinstatement. Crane access for tight yards.',
 array['Harare','Bluff','Hatfield','Chitungwiza'],
 '+263771234517', 'Mon-Sat, 06:30-16:00', true, true, true, true, false, 230),

(37, 18, 'demo-chipato-pest',      'Chipato Pest & Garden Treatments','individual','Property Care',
 'Cockroach, bedbug, termite and rodent treatments with a follow-up visit. Pet-safe products listed on the invoice.',
 array['Harare','Chitungwiza','Msasa','Waterfalls'],
 '+263771234518', 'Mon-Sat, 08:00-17:00', true, true, false, false, false, 62);

-- Services per provider. A real table rather than a nested array:
-- a text[] column types `col[i]` as text at parse time, so 2-D
-- subscripting fails even when the stored value is two-dimensional.
create temporary table if not exists demo_service (
  ordinal      int references demo_provider(ordinal),
  service_name text,
  category     text,
  price_note   text
) on commit drop;

insert into demo_service (ordinal, service_name, category, price_note) values
 (1, 'Solar system design and install',        'Solar, Inverters & Water', 'From US$1,400 for a 3kVA backup kit'),
 (1, 'Inverter and lithium battery servicing', 'Solar, Inverters & Water', 'US$45 call-out'),
 (1, 'Borehole pump installation',             'Solar, Inverters & Water', 'Quoted on site'),
 (2, 'Certificate of Compliance (COC)',        'Electrical', 'US$60 per residential property'),
 (2, 'DB board upgrade and rewiring',          'Electrical', 'From US$180'),
 (2, 'Fault finding and emergency call-outs',  'Electrical', 'US$40 within 30km'),
 (3, 'Geyser installation and element replacement', 'Plumbing', 'From US$95'),
 (3, 'Burst pipe and leak repair',             'Plumbing', 'US$35 call-out'),
 (3, 'Drain clearing and jetting',             'Plumbing', 'From US$70'),
 (4, 'Same-day parcel and goods delivery',     'Transport & Delivery', 'From US$12 per trip'),
 (4, 'Furniture and office moves',             'Transport & Delivery', 'From US$85'),
 (4, 'Airport transfers',                      'Transport & Delivery', 'US$35 per way'),
 (5, 'Roof repair and re-sheeting',            'Construction & Repairs', 'Quoted on inspection'),
 (5, 'Bathroom and kitchen renovation',        'Construction & Repairs', 'From US$900'),
 (5, 'Paving and boundary walls',              'Construction & Repairs', 'From US$38 per m2'),
 (6, 'Interior painting',                      'Construction & Repairs', 'US$4 per m2'),
 (6, 'Exterior and roof painting',             'Construction & Repairs', 'US$5 per m2'),
 (7, 'Deep clean and end-of-lease clean',      'Cleaning & Property Care', 'From US$120'),
 (7, 'Office and retail contract cleaning',    'Cleaning & Property Care', 'From US$9 per hour per cleaner'),
 (7, 'Solar panel washing',                    'Cleaning & Property Care', 'US$3 per panel'),
 (8, 'Lawn mowing and edging',                 'Property Care', 'From US$25 per visit'),
 (8, 'Hedge trimming and brush clearing',      'Property Care', 'From US$45'),
 (8, 'Fortnightly maintenance plan',           'Property Care', 'US$80 per month'),
 (9, 'Mobile car diagnostics',                 'Automotive', 'US$30'),
 (9, 'Alternator and starter rebuild',         'Automotive', 'From US$55'),
 (9, 'Wiring and lighting faults',             'Automotive', 'From US$40'),
 (10, 'Tyre supply and fitting',               'Automotive', 'From US$45 fitted'),
 (10, 'Battery supply and jump-start',         'Automotive', 'From US$60'),
 (11, 'Wedding and funeral PA hire',           'Events', 'From US$150 per day'),
 (11, 'Corporate sound and lighting',          'Events', 'From US$320 per event'),
 (11, 'Stage, chairs and marquee hire',        'Events', 'Quoted on guest count'),
 (12, 'Event catering per head',               'Events', 'US$6 to US$11 per guest'),
 (12, 'Office lunch platters',                 'Events', 'From US$40'),
 (13, 'O-level maths small group',             'Education & Tutoring', 'US$15 per month per student'),
 (13, 'A-level physics one-to-one',            'Education & Tutoring', 'US$12 per hour'),
 (13, 'Exam revision bootcamp',                'Education & Tutoring', 'US$30 per weekend'),
 (14, 'Business website build',                'Digital & Business Services', 'From US$280'),
 (14, 'Logo and brand kit',                    'Digital & Business Services', 'From US$120'),
 (14, 'Monthly bookkeeping',                   'Digital & Business Services', 'US$60 per month'),
 (15, 'Fridge and freezer repair',             'Appliance Repair', 'US$35 plus parts'),
 (15, 'Washing machine service',               'Appliance Repair', 'From US$40'),
 (15, 'Oven and stove element replacement',    'Appliance Repair', 'From US$30'),
 (16, 'Sliding and swing gate fabrication',    'Construction & Repairs', 'From US$220'),
 (16, 'Burglar bars and security doors',       'Construction & Repairs', 'From US$95'),
 (16, 'Carports and steel canopies',           'Construction & Repairs', 'Quoted on span');

-- Services for the second tranche. Category always matches the
-- provider's primary_category, which is what browse and search join on.
insert into demo_service (ordinal, service_name, category, price_note) values
 (17, 'Inverter and lithium backup design',    'Solar, Inverters & Water', 'From US$1,150 installed'),
 (17, 'Commercial solar arrays',               'Solar, Inverters & Water', 'Quoted after load audit'),
 (17, 'Zone changeover and DB integration',    'Solar, Inverters & Water', 'From US$160'),
 (18, 'Borehole drilling and casing',          'Solar, Inverters & Water', 'From US$90 per metre'),
 (18, 'Solar water heater installation',       'Solar, Inverters & Water', 'From US$210'),
 (18, 'Pump and control box replacement',      'Solar, Inverters & Water', 'US$50 plus parts'),
 (19, 'Drain jetting and CCTV inspection',     'Plumbing', 'From US$120'),
 (19, 'Grease trap supply and cleaning',       'Plumbing', 'From US$180'),
 (19, 'External pipework and leak location',   'Plumbing', 'US$45 call-out'),
 (20, 'Bathroom and en-suite refit',           'Plumbing', 'From US$450'),
 (20, 'Tap, cistert and shower repairs',       'Plumbing', 'From US$25'),
 (20, 'Geyser element and thermostat change',  'Plumbing', 'From US$60'),
 (21, 'Certificate of Compliance',             'Electrical', 'US$65 per property'),
 (21, 'New point wiring and lighting',         'Electrical', 'From US$30 per point'),
 (21, 'Geyser and heater circuits',            'Electrical', 'From US$85'),
 (22, 'Three-phase installation',              'Electrical', 'Quoted on load schedule'),
 (22, 'DB board upgrade and surge protection', 'Electrical', 'From US$220'),
 (22, 'Rental compliance inspections',         'Electrical', 'US$70 per unit'),
 (23, 'House moves with wrapping',             'Transport & Delivery', 'From US$190'),
 (23, 'Office and school equipment moves',     'Transport & Delivery', 'From US$260'),
 (23, 'Piano and safe handling',               'Transport & Delivery', 'Quoted on site'),
 (24, 'Staff shuttle contracts',               'Transport & Delivery', 'From US$420 per month'),
 (24, 'Funeral and wedding transport',         'Transport & Delivery', 'From US$120 per day'),
 (24, 'Cross-town freight',                    'Transport & Delivery', 'From US$25 per trip'),
 (25, 'Wall and extension bricklaying',        'Construction & Repairs', 'US$9 per m2'),
 (25, 'Paving, curbs and steps',               'Construction & Repairs', 'From US$34 per m2'),
 (25, 'Plastering and skimming',               'Construction & Repairs', 'US$7 per m2'),
 (26, 'Carpet and rug steam clean',            'Cleaning & Property Care', 'From US$18 per room'),
 (26, 'Sofa and suite detailing',              'Cleaning & Property Care', 'From US$55 per suite'),
 (26, 'One-off deep clean',                    'Cleaning & Property Care', 'From US$95'),
 (27, 'Night office contract cleaning',        'Cleaning & Property Care', 'From US$11 per hour per cleaner'),
 (27, 'Clinic and pharmacy hygiene contracts', 'Cleaning & Property Care', 'Quoted on floor area'),
 (27, 'Floor strip, wax and polish',           'Cleaning & Property Care', 'From US$5 per m2'),
 (28, 'Accident panel repair',                 'Automotive', 'From US$140 per panel'),
 (28, 'Spray booth respray',                   'Automotive', 'From US$320'),
 (28, 'Dent removal without repaint',          'Automotive', 'From US$75'),
 (29, 'Wedding reception decor',               'Events', 'From US$380'),
 (29, 'Table linen, crosiers and centrepieces','Events', 'From US$12 per table'),
 (29, 'Backdrop and step-and-repeat hire',     'Events', 'From US$95'),
 (30, 'O-level English coaching',              'Education & Tutoring', 'US$16 per month per student'),
 (30, 'Debating and public speaking',          'Education & Tutoring', 'US$10 per session'),
 (30, 'Vacation literacy intensive',           'Education & Tutoring', 'US$45 per week'),
 (31, 'Microsoft Desktop package course',      'Education & Tutoring', 'US$60 per person'),
 (31, 'Spreadsheet for small business',        'Education & Tutoring', 'US$75 per person'),
 (31, 'Typing and email skills',               'Education & Tutoring', 'US$40 per person'),
 (32, 'Business website (5 pages)',            'Digital & Business Services', 'From US$240'),
 (32, 'Google Business Profile setup',         'Digital & Business Services', 'From US$80'),
 (32, 'Product catalogue and quoting site',    'Digital & Business Services', 'From US$420'),
 (33, 'Social page management',                'Digital & Business Services', 'US$70 per month'),
 (33, 'Paid ads setup and reporting',          'Digital & Business Services', 'US$90 plus ad spend'),
 (33, 'WhatsApp Business catalogue setup',     'Digital & Business Services', 'From US$65'),
 (34, 'Fridge and freezer regas',              'Appliance Repair', 'From US$65 plus gas'),
 (34, 'Compressor replacement',                'Appliance Repair', 'From US$120'),
 (34, 'Display cabinet and cooler service',    'Appliance Repair', 'From US$85'),
 (35, 'Washing machine pump and belt repair',  'Appliance Repair', 'From US$45'),
 (35, 'Dryer element and thermostat',          'Appliance Repair', 'From US$55'),
 (35, 'Appliance control board repair',        'Appliance Repair', 'From US$80'),
 (36, 'Tree felling and limbing',              'Property Care', 'From US$120 per tree'),
 (36, 'Stump grinding',                        'Property Care', 'From US$80'),
 (36, 'Brush clearing and site clean-up',      'Property Care', 'From US$250 per acre'),
 (37, 'Cockroach and ant treatment',           'Property Care', 'From US$55 per unit'),
 (37, 'Bedbug heat and chemical treatment',    'Property Care', 'From US$90 per room'),
 (37, 'Termite barrier and rodent control',    'Property Care', 'From US$140');

insert into public.provider_profiles (
  id, user_id, slug, status, provider_type, business_name, description,
  primary_category, whatsapp_number, availability_note,
  email_confirmed, contact_confirmed, identity_reviewed,
  business_docs_reviewed, founding_provider,
  reviewed_by, reviewed_at, created_at
)
select
  gen_random_uuid(),
  o.uid,
  p.slug,
  'approved',
  p.provider_type,
  p.business_name,
  p.description,
  p.category,
  p.whatsapp,
  p.availability,
  p.email_ok, p.contact_ok, p.identity_ok, p.docs_ok, p.founding,
  null,
  now() - (p.created_offset * interval '1 day'),
  now() - (p.created_offset * interval '1 day')
from demo_provider p
join demo_owner o on o.ordinal = p.owner_ordinal
on conflict (slug) do nothing;

-- The services table is what category pages and search actually
-- filter on. The old build read it but never wrote it.
insert into public.provider_services (provider_profile_id, service_name, category, description, price_note)
select pp.id, s.service_name, s.category,
       'Available on request. Quote confirmed before work begins.', s.price_note
from public.provider_profiles pp
join demo_provider d on d.slug = pp.slug
join demo_service s on s.ordinal = d.ordinal
on conflict do nothing;

-- service_areas
insert into public.service_areas (provider_profile_id, area_name)
select pp.id, unnest(d.areas)
from public.provider_profiles pp
join demo_provider d on d.slug = pp.slug
on conflict do nothing;

-- ------------------------------------------------------------
-- 4. Reviews. One per reviewer per provider, enforced by the
--    unique constraint added in schema.sql.
-- ------------------------------------------------------------

create temporary table if not exists demo_review (
  slug text, reviewer int, rating int, content text
) on commit drop;

insert into demo_review (slug, reviewer, rating, content) values
 ('demo-mshai-solar',1,5,'Sized the system properly for what we actually run. No drops during the evening load-shedding block.'),
 ('demo-mshai-solar',2,5,'Gave a written plan before touching the roof. Clean install, labelled everything.'),
 ('demo-mshai-solar',3,4,'Good work, took two days longer than promised because the batteries were out of stock.'),
 ('demo-mshai-electrical',4,5,'Fixed a fault three other electricians gave up on. COC issued the same week.'),
 ('demo-mshai-electrical',5,4,'Thorough and honest about what did not need replacing.'),
 ('demo-chikafu-plumbing',6,5,'Came out on a Sunday for a burst pipe. Charged exactly what he quoted.'),
 ('demo-chikafu-plumbing',7,5,'New geyser installed in half a day and he cleaned up afterwards.'),
 ('demo-chikafu-plumbing',1,4,'Good job overall, had to call back once about a slow drain.'),
 ('demo-dube-transport',2,5,'Collected furniture in Chitungwiza and delivered same morning with photos as proof.'),
 ('demo-dube-transport',3,4,'Reliable. Van was an hour late but they phoned first.'),
 ('demo-nyathi-build',5,5,'Roof leak found and fixed properly the first time. Two storms since, still dry.'),
 ('demo-nyathi-build',6,4,'Solid work on the bathroom. Site was messy on day one but tidy at handover.'),
 ('demo-nyathi-build',7,5,'Gave a real schedule and stuck to it, which is rare.'),
 ('demo-nyathi-paint',8,4,'Even coats and sharp lines. Started a week after booking.'),
 ('demo-sibanda-clean',1,5,'End-of-lease clean got the full deposit back. Worth every dollar.'),
 ('demo-sibanda-clean',2,5,'They bring their own water, which matters out here.'),
 ('demo-sibanda-clean',3,4,'Good crew, arrived 40 minutes late.'),
 ('demo-sibanda-clean',4,5,'Panel washing made a visible difference to generation.'),
 ('demo-sibanda-garden',5,4,'Lawn is the best on the street now.'),
 ('demo-sibanda-garden',6,5,'Fortnightly plan, never missed a visit in four months.'),
 ('demo-marufu-auto',7,5,'Diagnosed the alternator on the roadside and rebuilt it same day.'),
 ('demo-marufu-auto',8,4,'Honest about what could wait instead of selling a full replacement.'),
 ('demo-marufu-tyres',1,4,'Fair price and quick fitting.'),
 ('demo-ncube-events',2,5,'Sound carried to the back of the yard and the generator never cut out.'),
 ('demo-ncube-events',3,5,'Professional crew, arrived early and set up without being chased.'),
 ('demo-ncube-events',4,4,'Good equipment. Lighting package was a bit basic.'),
 ('demo-ncube-catering',5,5,'Hot, generous and on time for 120 guests.'),
 ('demo-gumbo-tutor',6,5,'My daughter went from a 4 to an A in maths in one term.'),
 ('demo-gumbo-tutor',7,5,'Patient and actually teaches the method, not just the answers.'),
 ('demo-gumbo-tutor',8,4,'Great results, hard to get a Saturday morning slot.'),
 ('demo-gumbo-digital',1,5,'Site loads fast and customers find us on WhatsApp now.'),
 ('demo-gumbo-digital',2,4,'Good work, needed a few rounds of revision on the logo.'),
 ('demo-chikafu-appliance',3,5,'Fridge fixed in one visit, part was on the van.'),
 ('demo-chikafu-appliance',4,4,'Fair pricing, book out about a week ahead.'),
 ('demo-dube-weld',5,5,'Gate slides like new and the welds are neat.'),
 ('demo-dube-weld',6,4,'Strong work. Finish coat needed a touch-up.'),
 ('demo-dube-weld',7,5,'Came to the yard and welded on site, saved me the transport.'),
 ('demo-mhungu-power',11,5,'Inverter and battery bank sized from an actual load survey, not a guess. Runs the house through the night block.'),
 ('demo-mhungu-power',12,5,'Panel cleaning is on a contract now and generation is back to day one.'),
 ('demo-mhungu-power',13,4,'Good install. Took a week longer than quoted waiting on the battery shipment.'),
 ('demo-matiza-solar',14,5,'Borehole pump and solar package done in two days, documented the wiring for me.'),
 ('demo-matiza-solar',15,4,'Honest about what a 3kW array will and will not carry.'),
 ('demo-chiremba-drain',16,5,'Cleared a collapsed drain two other plumbers said needed digging up the whole yard.'),
 ('demo-chiremba-drain',17,5,'Blocked toilet sorted on a public holiday, charged the holiday rate they quoted first.'),
 ('demo-chiremba-drain',18,4,'Neat work on the new bathroom pipework. Follow-up call took a while.'),
 ('demo-gwanda-taps',19,5,'Replaced every tap seal in the house in a morning and water pressure is proper now.'),
 ('demo-gwanda-taps',20,4,'Fair price, came late but phoned to say so.'),
 ('demo-mavhunga-electric',1,5,'Rewired the shop and issued the COC without me chasing it twice.'),
 ('demo-mavhunga-electric',2,5,'Found the earth fault in under an hour. Three others had given up.'),
 ('demo-mavhunga-electric',3,4,'Solid work, just book early, she is in demand.'),
 ('demo-hashim-certs',4,5,'DB board upgrade done in a day with the power back on before evening.'),
 ('demo-hashim-certs',5,5,'Explained every circuit on the labelled board. Certificate arrived the same week.'),
 ('demo-chikore-movers',6,5,'Four bedroom house moved in one day and nothing was chipped.'),
 ('demo-chikore-movers',7,4,'Careful crew. Truck arrived late because of the airport roadworks.'),
 ('demo-chikore-movers',8,5,'Photos before pickup and on delivery, which is exactly what I wanted for the receipt.'),
 ('demo-makoni-shuttle',9,5,'Weekly staff shuttle has run on time for three months straight.'),
 ('demo-makoni-shuttle',10,4,'Reliable freight, but confirm the collection window in writing.'),
 ('demo-bvumbwe-bricks',11,5,'Wall and lintel done square and level, rubble cleared before leaving.'),
 ('demo-bvumbwe-bricks',12,5,'Built the boundary wall to the plan with no variation on the quote.'),
 ('demo-bvumbwe-bricks',13,4,'Good brickwork. Plaster took an extra week.'),
 ('demo-chipato-fresh',14,5,'Deep clean before moving in and the carpets came up like new.'),
 ('demo-chipato-fresh',15,4,'Thorough, though she brings her own supplies so order the consumables ahead.'),
 ('demo-mhangura-office',16,5,'Contract clean for two offices, always staffed, never had to chase an invoice.'),
 ('demo-mhangura-office',17,5,'Windows and floors done properly, day and night.'),
 ('demo-mhangura-office',18,4,'Good service, first fortnight took some adjusting to our access rules.'),
 ('demo-zvorwadza-body',19,5,'Accident damage repaired and the paint match is invisible.'),
 ('demo-zvorwadza-body',1,4,'Quality finish. Was without the car for ten days, longer than promised.'),
 ('demo-mhungu-decor',2,5,'Wedding decor set up before the guests arrived and struck the same night.'),
 ('demo-mhungu-decor',3,5,'Tables, draping and lighting all came together, and the price held.'),
 ('demo-mhungu-decor',4,4,'Nice work, one centrepiece was short so they topped it up on site.'),
 ('demo-chiremba-english',5,5,'Son stopped dreading the debate team. Now he is on it.'),
 ('demo-chiremba-english',6,4,'Patient and structured. Weekend slots fill up fast.'),
 ('demo-gwanda-it',7,5,'Two of us passed the computer basics certificate after evening classes.'),
 ('demo-gwanda-it',8,5,'Practical lessons on real machines, not just theory on a board.'),
 ('demo-mavhunga-web',9,5,'Rebuilt our site, it loads on data and the WhatsApp button brings orders in.'),
 ('demo-mavhunga-web',10,4,'Good design eye, needed chasing for the domain handover.'),
 ('demo-mavhunga-web',11,5,'They maintain the site too, which is worth the monthly fee.'),
 ('demo-chikore-ads',12,5,'Small budget, but the campaigns reach our suburb and only our suburb.'),
 ('demo-chikore-ads',13,4,'Reports are clear. Results took about a month to show.'),
 ('demo-makoni-fridge',14,5,'Two fridges and a deep freezer repaired the same afternoon, parts were on the van.'),
 ('demo-makoni-fridge',15,4,'Fixed what the first technician said was scrap. Charged fairly.'),
 ('demo-hashim-laundry',16,5,'Washer drum bearing replaced in a day and it is quiet again.'),
 ('demo-hashim-laundry',17,4,'Good repair, book a week ahead in winter.'),
 ('demo-bvumbwe-grounds',18,5,'Two big mangos cut back and the whole yard cleared in a morning.'),
 ('demo-bvumbwe-grounds',19,5,'Hedges cut straight and the green waste was taken away, not burned on site.'),
 ('demo-bvumbwe-grounds',20,4,'Reliable monthly plan, once needed a reminder.'),
 ('demo-chipato-pest',1,5,'Ants and termites treated, no sign of them since.'),
 ('demo-chipato-pest',3,4,'Effective treatment, ventilate the house properly afterwards.');

insert into public.reviews (user_id, provider_profile_id, rating, content, created_at)
select
  o.uid, pp.id, r.rating, r.content,
  now() - ((r.reviewer * 3 + r.rating) || ' days')::interval
from demo_review r
join public.provider_profiles pp on pp.slug = r.slug
join demo_owner o on o.ordinal = r.reviewer
on conflict (user_id, provider_profile_id) do nothing;

-- ------------------------------------------------------------
-- 5. One pending item so the admin queue is not empty on first
--    login, plus a contact message in the reports table.
-- ------------------------------------------------------------

insert into public.provider_profiles (
  user_id, slug, status, provider_type, business_name, description, primary_category, created_at
)
select o.uid, 'demo-holdridge-tiles', 'pending', 'individual',
       'Holdridge Tiling', 'Bathroom and floor tiling, waiting on documents before approval.',
       'Construction & Repairs', now() - interval '2 days'
from demo_owner o where o.ordinal = 4
on conflict (slug) do nothing;

insert into public.reports (reporter_name, reporter_email, target_type, reason, created_at)
select 'Chenai M.', 'chenai.m@example.co.zw', 'contact',
       '[provider] Looking for someone to retile a bathroom in Budiriro, roughly 6 square metres. Ideally before month end.',
       now() - interval '1 day'
where not exists (
  select 1 from public.reports where target_type = 'contact' and reason like '%retile a bathroom%'
);

-- ------------------------------------------------------------
-- 6. Admin account.
--    Change this email before deploying anywhere real. The
--    password is set by signing up on /account/register.html with
--    the same address, then running the update below.
-- ------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token
) values (
  'b0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin@pedyo.local',
  encode(gen_random_bytes(32), 'base64') || '#demodisabled', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Pedyo Admin"}'::jsonb, now(), now(), '', ''
)
on conflict (id) do nothing;

update public.profiles set is_admin = true
where id = 'b0000000-0000-4000-8000-000000000001';

commit;

-- ------------------------------------------------------------
-- Summary
-- ------------------------------------------------------------
select
  (select count(*) from public.service_categories)  as categories,
  (select count(*) from public.provider_profiles)   as providers,
  (select count(*) from public.provider_services)   as services,
  (select count(*) from public.service_areas)       as areas,
  (select count(*) from public.reviews)             as reviews;
