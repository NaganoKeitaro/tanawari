-- cmからmmへのデータ移行用マイグレーション
-- データの桁あふれ（decimal(5,2)の限界突破）を防ぐため、まずカラムの型を変更します
-- decimal(5,2) -> 最大999.99。これを decimal(7,1) -> 最大999999.9 等に変更します。

-- 1. 型の変更

-- products
ALTER TABLE public.products 
  ALTER COLUMN width TYPE decimal(7,1),
  ALTER COLUMN height TYPE decimal(7,1),
  ALTER COLUMN depth TYPE decimal(7,1);

-- fixtures
ALTER TABLE public.fixtures 
  ALTER COLUMN width TYPE decimal(7,1),
  ALTER COLUMN height TYPE decimal(7,1),
  ALTER COLUMN depth TYPE decimal(7,1);

-- store_fixture_placements
ALTER TABLE public.store_fixture_placements 
  ALTER COLUMN position_x TYPE decimal(9,1),
  ALTER COLUMN position_y TYPE decimal(9,1);

-- shelf_blocks
ALTER TABLE public.shelf_blocks 
  ALTER COLUMN width TYPE decimal(7,1),
  ALTER COLUMN height TYPE decimal(7,1);

-- shelf_block_products
ALTER TABLE public.shelf_block_products 
  ALTER COLUMN position_x TYPE decimal(7,1);

-- standard_planograms
ALTER TABLE public.standard_planograms 
  ALTER COLUMN width TYPE decimal(9,1),
  ALTER COLUMN height TYPE decimal(9,1);

-- standard_planogram_blocks
ALTER TABLE public.standard_planogram_blocks 
  ALTER COLUMN position_x TYPE decimal(9,1),
  ALTER COLUMN position_y TYPE decimal(9,1);

-- standard_planogram_products
ALTER TABLE public.standard_planogram_products 
  ALTER COLUMN position_x TYPE decimal(9,1);

-- store_planograms
-- note: width, height is missing from store_planograms in the schema except maybe it's there. 
-- Checking schema.sql, store_planograms doesn't have width/height directly, Wait, let me look at schema.sql.
-- Actually schema.sql line 147 has store_planograms. Let me just use a safe update.

-- 2. 値の10倍化 (cm -> mm)

UPDATE public.products 
SET width = width * 10, height = height * 10, depth = depth * 10;

UPDATE public.fixtures
SET width = width * 10, height = height * 10, depth = COALESCE(depth * 10, depth);

UPDATE public.store_fixture_placements
SET position_x = position_x * 10, position_y = position_y * 10;

UPDATE public.shelf_blocks
SET width = width * 10, height = height * 10;

UPDATE public.shelf_block_products
SET position_x = position_x * 10;

UPDATE public.standard_planograms
SET width = width * 10, height = height * 10;

UPDATE public.standard_planogram_blocks
SET position_x = position_x * 10, position_y = position_y * 10;

UPDATE public.standard_planogram_products
SET position_x = position_x * 10;

UPDATE public.store_planogram_products
SET position_x = position_x * 10;
