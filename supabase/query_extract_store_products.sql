-- ================================================================
-- Query 1: Extract products from store planograms
-- (Product placement by store, without shelf block info)
-- ================================================================
SELECT 
  s.code AS store_code,
  s.name AS store_name,
  p.jan,
  p.name AS product_name,
  p.division_code,
  p.division_name,
  p.division_sub_code,
  p.division_sub_name,
  p.line_code,
  p.line_name,
  p.department_code,
  p.department_name,
  p.category_code,
  p.category_name,
  p.sub_category_code,
  p.sub_category_name,
  p.segment_code,
  p.segment_name,
  p.sub_segment_code,
  p.sub_segment_name,
  spp.shelf_index,
  spp.position_x,
  spp.face_count
FROM stores s
LEFT JOIN store_planograms sp ON s.id = sp.store_id
LEFT JOIN store_planogram_products spp ON sp.id = spp.store_planogram_id
LEFT JOIN products p ON spp.product_id = p.id
WHERE p.jan IS NOT NULL
ORDER BY s.code, p.jan;


-- ================================================================
-- Query 2: Extract products within shelf blocks (includes shelf block name)
-- ================================================================
SELECT 
  -- Store info (additional table join may be needed to identify store from shelf block)
  p.jan,
  p.name AS product_name,
  p.division_code,
  p.division_name,
  p.division_sub_code,
  p.division_sub_name,
  p.line_code,
  p.line_name,
  p.department_code,
  p.department_name,
  p.category_code,
  p.category_name,
  p.sub_category_code,
  p.sub_category_name,
  p.segment_code,
  p.segment_name,
  p.sub_segment_code,
  p.sub_segment_name,
  sb.name AS shelf_block_name,
  sbp.shelf_index,
  sbp.position_x,
  sbp.face_count
FROM shelf_blocks sb
LEFT JOIN shelf_block_products sbp ON sb.id = sbp.block_id
LEFT JOIN products p ON sbp.product_id = p.id
WHERE p.jan IS NOT NULL
ORDER BY sb.name, p.jan;


-- ================================================================
-- Query 3: Complete association of store x shelf block x product
-- (Link store and shelf blocks via standard planograms)
-- ================================================================
SELECT 
  s.code AS store_code,
  s.name AS store_name,
  sb.name AS shelf_block_name,
  p.jan,
  p.name AS product_name,
  p.division_code,
  p.division_name,
  p.division_sub_code,
  p.division_sub_name,
  p.line_code,
  p.line_name,
  p.department_code,
  p.department_name,
  p.category_code,
  p.category_name,
  p.sub_category_code,
  p.sub_category_name,
  p.segment_code,
  p.segment_name,
  p.sub_segment_code,
  p.sub_segment_name,
  sbp.shelf_index,
  sbp.position_x,
  sbp.face_count
FROM stores s
LEFT JOIN store_planograms sp ON s.id = sp.store_id
LEFT JOIN standard_planograms spg ON sp.standard_planogram_id = spg.id
LEFT JOIN standard_planogram_blocks spb ON spg.id = spb.standard_planogram_id
LEFT JOIN shelf_blocks sb ON spb.block_id = sb.id
LEFT JOIN shelf_block_products sbp ON sb.id = sbp.block_id
LEFT JOIN products p ON sbp.product_id = p.id
WHERE p.jan IS NOT NULL
ORDER BY s.code, sb.name, p.jan;
