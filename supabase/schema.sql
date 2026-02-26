-- Supabase Initialization Script based on database_logical_design.md

-- 1. stores
CREATE TABLE public.stores (
  id uuid primary key default gen_random_uuid(),
  code varchar(20) unique not null,
  name varchar(100) not null,
  fmt varchar(20) not null,
  region varchar(20) not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 2. products
CREATE TABLE public.products (
  id uuid primary key default gen_random_uuid(),
  jan varchar(13) unique,
  name varchar(255) not null,
  width decimal(5,2) not null,
  height decimal(5,2) not null,
  depth decimal(5,2) not null,
  category varchar(50),
  image_url text,
  sales_rank int,
  sales_quantity int,
  quantity int,
  sales decimal,
  gross_profit decimal,
  traffic int,
  spend_per_customer decimal,
  division_code varchar,
  department_code varchar,
  category_code varchar,
  sub_category_code varchar,
  segment_code varchar,
  sub_segment_code varchar,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 3. fixtures
CREATE TABLE public.fixtures (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  width decimal(5,2) not null,
  height decimal(5,2) not null,
  depth decimal(5,2),
  shelf_count int not null,
  manufacturer varchar(100),
  model_number varchar(100),
  install_date date,
  warranty_end_date date,
  fixture_type varchar(50),
  created_at timestamp with time zone default now() not null
);

-- 4. store_fixture_placements
CREATE TABLE public.store_fixture_placements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade not null,
  fixture_id uuid references public.fixtures(id) on delete cascade not null,
  position_x decimal(8,2) not null,
  position_y decimal(8,2) not null,
  "order" int not null,
  direction int default 0,
  zone varchar(50),
  label varchar(100),
  created_at timestamp with time zone default now() not null
);

-- 5. shelf_blocks
CREATE TABLE public.shelf_blocks (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  description text,
  block_type varchar(50),
  width decimal(5,2) not null,
  height decimal(5,2) not null,
  shelf_count int not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 6. shelf_block_products
CREATE TABLE public.shelf_block_products (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references public.shelf_blocks(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  shelf_index int not null,
  position_x decimal(5,2) not null,
  face_count int default 1 not null
);

-- 7. standard_planograms
CREATE TABLE public.standard_planograms (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  fmt varchar(20) not null,
  base_store_id uuid references public.stores(id) not null,
  fixture_type varchar(50),
  width decimal(8,2) not null,
  height decimal(8,2) not null,
  shelf_count int not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 8. standard_planogram_blocks
CREATE TABLE public.standard_planogram_blocks (
  id uuid primary key default gen_random_uuid(),
  standard_planogram_id uuid references public.standard_planograms(id) on delete cascade not null,
  block_id uuid references public.shelf_blocks(id) on delete cascade not null,
  position_x decimal(8,2) not null,
  position_y decimal(8,2) not null
);

-- 9. standard_planogram_products
CREATE TABLE public.standard_planogram_products (
  id uuid primary key default gen_random_uuid(),
  standard_planogram_id uuid references public.standard_planograms(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  shelf_index int not null,
  position_x decimal(8,2) not null,
  face_count int not null
);

-- 10. store_planograms
CREATE TABLE public.store_planograms (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade not null,
  standard_planogram_id uuid references public.standard_planograms(id) not null,
  status varchar(20) not null,
  warnings jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  synced_at timestamp with time zone
);

-- 11. store_planogram_products
CREATE TABLE public.store_planogram_products (
  id uuid primary key default gen_random_uuid(),
  store_planogram_id uuid references public.store_planograms(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  shelf_index int not null,
  position_x decimal(8,2) not null,
  face_count int not null,
  is_auto_generated boolean default false,
  is_cut boolean default false
);

-- ===== ENABLE ROW LEVEL SECURITY =====
alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.fixtures enable row level security;
alter table public.store_fixture_placements enable row level security;
alter table public.shelf_blocks enable row level security;
alter table public.shelf_block_products enable row level security;
alter table public.standard_planograms enable row level security;
alter table public.standard_planogram_blocks enable row level security;
alter table public.standard_planogram_products enable row level security;
alter table public.store_planograms enable row level security;
alter table public.store_planogram_products enable row level security;

-- ===== SETUP RLS POLICIES (Allow All for MVP) =====
-- Note: In production with Auth, these should be restricted to authenticated users.
create policy "Allow all operations for anon - products" on public.products for all using (true) with check (true);
create policy "Allow all operations for anon - stores" on public.stores for all using (true) with check (true);
create policy "Allow all operations for anon - fixtures" on public.fixtures for all using (true) with check (true);
create policy "Allow all operations for anon - store_fixture_placements" on public.store_fixture_placements for all using (true) with check (true);
create policy "Allow all operations for anon - shelf_blocks" on public.shelf_blocks for all using (true) with check (true);
create policy "Allow all operations for anon - shelf_block_products" on public.shelf_block_products for all using (true) with check (true);
create policy "Allow all operations for anon - standard_planograms" on public.standard_planograms for all using (true) with check (true);
create policy "Allow all operations for anon - standard_planogram_blocks" on public.standard_planogram_blocks for all using (true) with check (true);
create policy "Allow all operations for anon - standard_planogram_products" on public.standard_planogram_products for all using (true) with check (true);
create policy "Allow all operations for anon - store_planograms" on public.store_planograms for all using (true) with check (true);
create policy "Allow all operations for anon - store_planogram_products" on public.store_planogram_products for all using (true) with check (true);
