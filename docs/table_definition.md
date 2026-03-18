# Table Definition

## Table List
| table_name | description |
|------------|-------------|
| products | 商品マスタ。JAN・寸法・売上ランク・8階層分類・分析指標を管理 |
| stores | 店舗マスタ。店舗コード・FMT・地域を管理 |
| fixtures | 什器マスタ。寸法・段数・什器タイプを管理 |
| product_hierarchy | 商品階層マスタ。8階層の商品分類体系を管理 |
| store_fixture_placements | 店舗什器配置。フロア上の什器位置・方向・ゾーンを管理 |
| shelf_blocks | 棚ブロック。商品グループテンプレートの定義を管理 |
| shelf_block_products | ブロック内商品配置。ブロック内の商品位置・フェイス数を管理 |
| standard_planograms | 標準棚割。FMT基準の棚割定義を管理 |
| standard_planogram_blocks | 標準棚割ブロック配置。標準棚割内のブロック位置を管理 |
| standard_planogram_products | 標準棚割商品。標準棚割内の展開済み商品配置を管理 |
| store_planograms | 個店棚割。店舗固有の棚割・ステータス・警告を管理 |
| store_planogram_products | 個店棚割商品。個店棚割内の商品配置・自動生成フラグを管理 |

## Table Detail

### products

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| jan | varchar(13) | - | - | NULL | JANコード（JANなし商品も許容） |
| name | varchar(255) | - | - | NOT NULL | 商品名 |
| width | decimal(8,2) | - | - | NOT NULL | 幅（mm） |
| height | decimal(8,2) | - | - | NOT NULL | 高さ（mm） |
| depth | decimal(8,2) | - | - | NOT NULL | 奥行き（mm） |
| category | varchar(100) | - | - | NOT NULL | カテゴリ名 |
| image_url | text | - | - | NULL | 商品画像URL |
| sales_rank | integer | - | - | NOT NULL | 売上ランク（1-100、1が最高） |
| sales | decimal(12,2) | - | - | NULL | 売上金額 |
| gross_profit | decimal(12,2) | - | - | NULL | 粗利金額 |
| traffic | integer | - | - | NULL | 客数 |
| quantity | integer | - | - | NULL | 販売数量 |
| spend_per_customer | decimal(10,2) | - | - | NULL | 客単価 |
| division_code | varchar(20) | - | - | NULL | 事業部コード |
| division_name | varchar(100) | - | - | NULL | 事業部名 |
| division_sub_code | varchar(20) | - | - | NULL | ディビジョンコード |
| division_sub_name | varchar(100) | - | - | NULL | ディビジョン名 |
| line_code | varchar(20) | - | - | NULL | ラインコード |
| line_name | varchar(100) | - | - | NULL | ライン名 |
| department_code | varchar(20) | - | - | NULL | 部門コード |
| department_name | varchar(100) | - | - | NULL | 部門名 |
| category_code | varchar(20) | - | - | NULL | カテゴリコード |
| category_name | varchar(100) | - | - | NULL | カテゴリ名（階層） |
| sub_category_code | varchar(20) | - | - | NULL | サブカテゴリコード |
| sub_category_name | varchar(100) | - | - | NULL | サブカテゴリ名 |
| segment_code | varchar(20) | - | - | NULL | セグメントコード |
| segment_name | varchar(100) | - | - | NULL | セグメント名 |
| sub_segment_code | varchar(20) | - | - | NULL | サブセグメントコード |
| sub_segment_name | varchar(100) | - | - | NULL | サブセグメント名 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |
| updated_at | timestamptz | - | - | NOT NULL | 更新日時（デフォルト: now()） |

### stores

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| code | varchar(20) | - | - | NOT NULL | 店舗コード（FMTプレフィックス＋4桁番号、UNIQUE） |
| name | varchar(255) | - | - | NOT NULL | 店舗名 |
| fmt | varchar(10) | - | - | NOT NULL | FMT（MEGA/SuC/SMART/GO/FC） |
| region | varchar(20) | - | - | NOT NULL | 地域 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |
| updated_at | timestamptz | - | - | NOT NULL | 更新日時（デフォルト: now()） |

### fixtures

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| name | varchar(255) | - | - | NOT NULL | 什器名 |
| width | decimal(8,2) | - | - | NOT NULL | 幅（mm） |
| height | decimal(8,2) | - | - | NOT NULL | 高さ（mm） |
| depth | decimal(8,2) | - | - | NOT NULL | 奥行き（mm） |
| shelf_count | integer | - | - | NOT NULL | 段数 |
| fixture_type | varchar(30) | - | - | NOT NULL | 什器タイプ |
| manufacturer | varchar(100) | - | - | NULL | メーカー名 |
| model_number | varchar(50) | - | - | NULL | 型番 |
| install_date | date | - | - | NULL | 設置日 |
| warranty_end_date | date | - | - | NULL | 保証期限 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |

### product_hierarchy

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| division_code | varchar(20) | - | - | NULL | 事業部コード |
| division_name | varchar(100) | - | - | NULL | 事業部名 |
| division_sub_code | varchar(20) | - | - | NULL | ディビジョンコード |
| division_sub_name | varchar(100) | - | - | NULL | ディビジョン名 |
| line_code | varchar(20) | - | - | NULL | ラインコード |
| line_name | varchar(100) | - | - | NULL | ライン名 |
| department_code | varchar(20) | - | - | NULL | 部門コード |
| department_name | varchar(100) | - | - | NULL | 部門名 |
| category_code | varchar(20) | - | - | NULL | カテゴリコード |
| category_name | varchar(100) | - | - | NULL | カテゴリ名 |
| sub_category_code | varchar(20) | - | - | NULL | サブカテゴリコード |
| sub_category_name | varchar(100) | - | - | NULL | サブカテゴリ名 |
| segment_code | varchar(20) | - | - | NULL | セグメントコード |
| segment_name | varchar(100) | - | - | NULL | セグメント名 |
| sub_segment_code | varchar(20) | - | - | NULL | サブセグメントコード |
| sub_segment_name | varchar(100) | - | - | NULL | サブセグメント名 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |
| updated_at | timestamptz | - | - | NOT NULL | 更新日時（デフォルト: now()） |

### store_fixture_placements

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| store_id | uuid | - | FK(stores.id) | NOT NULL | 店舗ID |
| fixture_id | uuid | - | FK(fixtures.id) | NOT NULL | 什器ID |
| position_x | decimal(10,2) | - | - | NOT NULL | X座標（mm） |
| position_y | decimal(10,2) | - | - | NOT NULL | Y座標（mm） |
| order_num | integer | - | - | NOT NULL | 配置順序 |
| direction | integer | - | - | NULL | 回転角度（0/90/180/270） |
| zone | varchar(20) | - | - | NULL | ゾーン |
| label | varchar(100) | - | - | NULL | カスタムラベル |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |

### shelf_blocks

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| name | varchar(255) | - | - | NOT NULL | ブロック名 |
| description | text | - | - | NULL | 説明 |
| block_type | varchar(20) | - | - | NULL | ブロックタイプ（multi-tier/flat） |
| width | decimal(8,2) | - | - | NOT NULL | 幅（mm） |
| height | decimal(8,2) | - | - | NOT NULL | 高さ（mm） |
| shelf_count | integer | - | - | NOT NULL | 段数 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |
| updated_at | timestamptz | - | - | NOT NULL | 更新日時（デフォルト: now()） |

### shelf_block_products

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| block_id | uuid | - | FK(shelf_blocks.id) | NOT NULL | ブロックID |
| product_id | uuid | - | FK(products.id) | NOT NULL | 商品ID |
| shelf_index | integer | - | - | NOT NULL | 段インデックス（0始まり） |
| position_x | decimal(8,2) | - | - | NOT NULL | 段内X座標（mm） |
| face_count | integer | - | - | NOT NULL | フェイス数 |

### standard_planograms

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| name | varchar(255) | - | - | NOT NULL | 棚割名 |
| fmt | varchar(10) | - | - | NOT NULL | FMT |
| base_store_id | uuid | - | FK(stores.id) | NOT NULL | 基準店舗ID |
| fixture_type | varchar(30) | - | - | NULL | 什器タイプ |
| width | decimal(8,2) | - | - | NOT NULL | 幅（mm） |
| height | decimal(8,2) | - | - | NOT NULL | 高さ（mm） |
| shelf_count | integer | - | - | NOT NULL | 段数 |
| start_date | date | - | - | NULL | 適用開始日 |
| end_date | date | - | - | NULL | 適用終了日 |
| description | text | - | - | NULL | 説明 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |
| updated_at | timestamptz | - | - | NOT NULL | 更新日時（デフォルト: now()） |

### standard_planogram_blocks

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| standard_planogram_id | uuid | - | FK(standard_planograms.id) | NOT NULL | 標準棚割ID |
| block_id | uuid | - | FK(shelf_blocks.id) | NOT NULL | ブロックID |
| position_x | decimal(8,2) | - | - | NOT NULL | X座標（mm） |
| position_y | decimal(8,2) | - | - | NOT NULL | Y座標（mm） |

### standard_planogram_products

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| standard_planogram_id | uuid | - | FK(standard_planograms.id) | NOT NULL | 標準棚割ID |
| product_id | uuid | - | FK(products.id) | NOT NULL | 商品ID |
| shelf_index | integer | - | - | NOT NULL | 段インデックス（0始まり） |
| position_x | decimal(8,2) | - | - | NOT NULL | 段内X座標（mm） |
| face_count | integer | - | - | NOT NULL | フェイス数 |

### store_planograms

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| store_id | uuid | - | FK(stores.id) | NOT NULL | 店舗ID |
| standard_planogram_id | uuid | - | FK(standard_planograms.id) | NOT NULL | 標準棚割ID |
| width | decimal(8,2) | - | - | NOT NULL | 幅（mm） |
| height | decimal(8,2) | - | - | NOT NULL | 高さ（mm） |
| shelf_count | integer | - | - | NOT NULL | 段数 |
| status | varchar(20) | - | - | NOT NULL | ステータス（pending/generated/warning/error/synced） |
| warnings | jsonb | - | - | NOT NULL | 警告メッセージ配列（デフォルト: '[]'） |
| synced_at | timestamptz | - | - | NULL | 最終同期日時 |
| created_at | timestamptz | - | - | NOT NULL | 作成日時（デフォルト: now()） |
| updated_at | timestamptz | - | - | NOT NULL | 更新日時（デフォルト: now()） |

### store_planogram_products

| column_name | type | pk | fk | nullable | description |
|-------------|------|----|----|----------|-------------|
| id | uuid | PK | - | NOT NULL | 一意識別子（自動生成） |
| store_planogram_id | uuid | - | FK(store_planograms.id) | NOT NULL | 個店棚割ID |
| product_id | uuid | - | FK(products.id) | NOT NULL | 商品ID |
| shelf_index | integer | - | - | NOT NULL | 段インデックス（0始まり） |
| position_x | decimal(8,2) | - | - | NOT NULL | 段内X座標（mm） |
| face_count | integer | - | - | NOT NULL | フェイス数 |
| is_auto_generated | boolean | - | - | NOT NULL | ルールA/B自動適用フラグ（デフォルト: false） |
| is_cut | boolean | - | - | NOT NULL | ルールAカットフラグ（デフォルト: false） |
