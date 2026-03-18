# Index Definition

## Index List
| index_name | table_name | columns | unique | description |
|------------|-----------|---------|--------|-------------|
| idx_products_pk | products | id | yes | 主キーインデックス |
| idx_products_jan | products | jan | no | JANコード検索用（NULLあり） |
| idx_products_category | products | category | no | カテゴリ別絞り込み用 |
| idx_products_sales_rank | products | sales_rank | no | 売上ランクソート・フィルタ用 |
| idx_products_division_code | products | division_code | no | 事業部コード別検索用 |
| idx_products_department_code | products | department_code | no | 部門コード別検索用 |
| idx_products_category_code | products | category_code | no | カテゴリコード別検索用 |
| idx_stores_pk | stores | id | yes | 主キーインデックス |
| idx_stores_code | stores | code | yes | 店舗コードユニーク制約 |
| idx_stores_fmt | stores | fmt | no | FMT別絞り込み用 |
| idx_stores_region | stores | region | no | 地域別絞り込み用 |
| idx_fixtures_pk | fixtures | id | yes | 主キーインデックス |
| idx_fixtures_type | fixtures | fixture_type | no | 什器タイプ別絞り込み用 |
| idx_product_hierarchy_pk | product_hierarchy | id | yes | 主キーインデックス |
| idx_product_hierarchy_division | product_hierarchy | division_code | no | 事業部コード検索用 |
| idx_sfp_pk | store_fixture_placements | id | yes | 主キーインデックス |
| idx_sfp_store_id | store_fixture_placements | store_id | no | 店舗別什器配置検索用 |
| idx_sfp_fixture_id | store_fixture_placements | fixture_id | no | 什器別配置検索用 |
| idx_sfp_store_fixture | store_fixture_placements | store_id, fixture_id | no | 店舗×什器の複合検索用 |
| idx_shelf_blocks_pk | shelf_blocks | id | yes | 主キーインデックス |
| idx_shelf_blocks_type | shelf_blocks | block_type | no | ブロックタイプ別絞り込み用 |
| idx_sbp_pk | shelf_block_products | id | yes | 主キーインデックス |
| idx_sbp_block_id | shelf_block_products | block_id | no | ブロック別商品検索用 |
| idx_sbp_product_id | shelf_block_products | product_id | no | 商品別ブロック参照検索用 |
| idx_sp_pk | standard_planograms | id | yes | 主キーインデックス |
| idx_sp_fmt | standard_planograms | fmt | no | FMT別絞り込み用 |
| idx_sp_base_store | standard_planograms | base_store_id | no | 基準店舗別検索用 |
| idx_sp_fixture_type | standard_planograms | fixture_type | no | 什器タイプ別絞り込み用 |
| idx_sp_date_range | standard_planograms | start_date, end_date | no | 適用期間範囲検索用 |
| idx_spb_pk | standard_planogram_blocks | id | yes | 主キーインデックス |
| idx_spb_planogram_id | standard_planogram_blocks | standard_planogram_id | no | 標準棚割別ブロック検索用 |
| idx_spb_block_id | standard_planogram_blocks | block_id | no | ブロック別使用先検索用 |
| idx_spp_pk | standard_planogram_products | id | yes | 主キーインデックス |
| idx_spp_planogram_id | standard_planogram_products | standard_planogram_id | no | 標準棚割別商品検索用 |
| idx_spp_product_id | standard_planogram_products | product_id | no | 商品別標準棚割参照検索用 |
| idx_store_planograms_pk | store_planograms | id | yes | 主キーインデックス |
| idx_store_planograms_store | store_planograms | store_id | no | 店舗別個店棚割検索用 |
| idx_store_planograms_standard | store_planograms | standard_planogram_id | no | 標準棚割別個店棚割検索用 |
| idx_store_planograms_status | store_planograms | status | no | ステータス別絞り込み用 |
| idx_store_planograms_store_standard | store_planograms | store_id, standard_planogram_id | yes | 店舗×標準棚割の一意制約 |
| idx_stpp_pk | store_planogram_products | id | yes | 主キーインデックス |
| idx_stpp_planogram_id | store_planogram_products | store_planogram_id | no | 個店棚割別商品検索用 |
| idx_stpp_product_id | store_planogram_products | product_id | no | 商品別個店棚割参照検索用 |
| idx_stpp_auto_generated | store_planogram_products | is_auto_generated | no | 自動生成商品絞り込み用 |
| idx_stpp_is_cut | store_planogram_products | is_cut | no | カット対象商品絞り込み用 |
