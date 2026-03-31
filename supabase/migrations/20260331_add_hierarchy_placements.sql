-- 棚ブロック・標準棚割・個店棚割に商品階層配置テーブルを追加

-- 1. shelf_block_hierarchy_placements
CREATE TABLE public.shelf_block_hierarchy_placements (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references public.shelf_blocks(id) on delete cascade not null,
  hierarchy_level varchar(20) not null,
  hierarchy_code varchar(50) not null,
  hierarchy_name varchar(100) not null,
  shelf_index int not null,
  position_x decimal(8,2) not null,
  width decimal(8,2) not null default 300,
  face_count int not null default 1
);

-- 2. standard_planogram_hierarchy_placements
CREATE TABLE public.standard_planogram_hierarchy_placements (
  id uuid primary key default gen_random_uuid(),
  standard_planogram_id uuid references public.standard_planograms(id) on delete cascade not null,
  hierarchy_level varchar(20) not null,
  hierarchy_code varchar(50) not null,
  hierarchy_name varchar(100) not null,
  shelf_index int not null,
  position_x decimal(8,2) not null,
  width decimal(8,2) not null default 300,
  face_count int not null default 1,
  placed_block_id uuid
);

-- 3. store_planogram_hierarchy_placements
CREATE TABLE public.store_planogram_hierarchy_placements (
  id uuid primary key default gen_random_uuid(),
  store_planogram_id uuid references public.store_planograms(id) on delete cascade not null,
  hierarchy_level varchar(20) not null,
  hierarchy_code varchar(50) not null,
  hierarchy_name varchar(100) not null,
  shelf_index int not null,
  position_x decimal(8,2) not null,
  width decimal(8,2) not null default 300,
  face_count int not null default 1,
  is_auto_generated boolean default false
);

-- RLS
ALTER TABLE public.shelf_block_hierarchy_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_planogram_hierarchy_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_planogram_hierarchy_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all - shelf_block_hierarchy_placements" ON public.shelf_block_hierarchy_placements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all - standard_planogram_hierarchy_placements" ON public.standard_planogram_hierarchy_placements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all - store_planogram_hierarchy_placements" ON public.store_planogram_hierarchy_placements FOR ALL USING (true) WITH CHECK (true);
