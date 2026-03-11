-- Fix decimal precision for shelf_block_products.position_x and shelf_blocks.width
-- decimal(5,2) allows max 999.99mm which overflows for blocks wider than 1000mm
-- Changing to decimal(8,2) to match other product tables (standard_planogram_products, etc.)

ALTER TABLE public.shelf_block_products
  ALTER COLUMN position_x TYPE decimal(8,2);

ALTER TABLE public.shelf_blocks
  ALTER COLUMN width TYPE decimal(8,2);
