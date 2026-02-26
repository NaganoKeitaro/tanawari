-- 12. product_hierarchy
CREATE TABLE public.product_hierarchy (
  id uuid primary key default gen_random_uuid(),
  division_code varchar(50),
  division_name varchar(100),
  division_sub_code varchar(50),
  division_sub_name varchar(100),
  line_code varchar(50),
  line_name varchar(100),
  department_code varchar(50),
  department_name varchar(100),
  category_code varchar(50),
  category_name varchar(100),
  sub_category_code varchar(50),
  sub_category_name varchar(100),
  segment_code varchar(50),
  segment_name varchar(100),
  sub_segment_code varchar(50),
  sub_segment_name varchar(100),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.product_hierarchy enable row level security;
create policy "Allow all operations for anon - product_hierarchy" on public.product_hierarchy for all using (true) with check (true);
