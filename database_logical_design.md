# データベース論理設計書 (Database Logical Design Document)

**作成日**: 2026-01-09
**プロジェクト**: 棚割管理システム (Planogram System) MVP

## 1. 概要
本ドキュメントは、棚割管理システムにおけるデータ構造をリレーショナルデータベース形式のテーブル定義として記述したものである。

## 2. ER図 (Entity-Relationship Diagram)

![ER Diagram](./docs/images/er_diagram.png)

## 3. テーブル定義

### 3.1 マスタ系テーブル

#### 3.1.1 products (商品マスタ)
商品の基本情報を管理する。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | 商品ID | VARCHAR(36) | PK | UUID |
| jan | JANコード | VARCHAR(13) | UNIQUE, NOT NULL | |
| name | 商品名 | VARCHAR(255) | NOT NULL | |
| width | 幅 | DECIMAL(5,2) | NOT NULL | cm単位 |
| height | 高さ | DECIMAL(5,2) | NOT NULL | cm単位 |
| depth | 奥行 | DECIMAL(5,2) | NOT NULL | cm単位 |
| category | カテゴリ | VARCHAR(50) | | |
| image_url | 画像URL | VARCHAR(2048) | | |
| sales_rank | 売上ランク | INT | NOT NULL | 1-100 (1が最高) |
| created_at | 作成日時 | DATETIME | NOT NULL | |
| updated_at | 更新日時 | DATETIME | NOT NULL | |

#### 3.1.2 stores (店舗マスタ)
店舗の基本情報を管理する。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | 店舗ID | VARCHAR(36) | PK | UUID |
| code | 店舗コード | VARCHAR(20) | UNIQUE, NOT NULL | |
| name | 店舗名 | VARCHAR(100) | NOT NULL | |
| fmt | 業態 | VARCHAR(20) | NOT NULL | 'MEGA', 'SuC' 等 |
| region | 地域 | VARCHAR(20) | NOT NULL | '関東', '近畿' 等 |
| created_at | 作成日時 | DATETIME | NOT NULL | |
| updated_at | 更新日時 | DATETIME | NOT NULL | |

#### 3.1.3 fixtures (什器マスタ)
店舗で使用可能な什器の定義。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | 什器ID | VARCHAR(36) | PK | UUID |
| name | 什器名 | VARCHAR(100) | NOT NULL | |
| width | 幅 | DECIMAL(5,2) | NOT NULL | cm単位 |
| height | 高さ | DECIMAL(5,2) | NOT NULL | cm単位 |
| shelf_count | 棚段数 | INT | NOT NULL | デフォルトの段数 |
| manufacturer | メーカー | VARCHAR(100) | | |
| created_at | 作成日時 | DATETIME | NOT NULL | |

### 3.2 構成定義テーブル

#### 3.2.1 store_fixture_placements (店舗什器配置)
各店舗にどの什器がどのように配置されているかを定義するテーブル。これが店舗個別の「棚枠」を形成する。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | 配置ID | VARCHAR(36) | PK | UUID |
| store_id | 店舗ID | VARCHAR(36) | FK(stores) | |
| fixture_id | 什器ID | VARCHAR(36) | FK(fixtures) | |
| position_x | 横位置 | DECIMAL(8,2) | NOT NULL | レイアウト上の絶対座標(cm) |
| position_y | 縦位置 | DECIMAL(8,2) | NOT NULL | レイアウト上の絶対座標(cm) |
| order | 配置順 | INT | NOT NULL | 左からの並び順 |
| created_at | 作成日時 | DATETIME | NOT NULL | |

#### 3.2.2 shelf_blocks (棚ブロック)
商品の組み合わせパターン（テンプレート）を定義する。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | ブロックID | VARCHAR(36) | PK | UUID |
| name | ブロック名 | VARCHAR(100) | NOT NULL | |
| description | 説明 | TEXT | | |
| width | ブロック幅 | DECIMAL(5,2) | NOT NULL | cm単位 |
| height | ブロック高さ | DECIMAL(5,2) | NOT NULL | cm単位 |
| shelf_count | 段数 | INT | NOT NULL | |
| created_at | 作成日時 | DATETIME | NOT NULL | |
| updated_at | 更新日時 | DATETIME | NOT NULL | |

#### 3.2.3 shelf_block_products (ブロック内商品配置)
棚ブロック内の商品配置詳細。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | ID | VARCHAR(36) | PK | UUID |
| block_id | ブロックID | VARCHAR(36) | FK(shelf_blocks) | |
| product_id | 商品ID | VARCHAR(36) | FK(products) | |
| shelf_index | 段位置 | INT | NOT NULL | 0-indexed (上または下から) |
| position_x | 横位置 | DECIMAL(5,2) | NOT NULL | ブロック左端からの距離(cm) |
| face_count | フェイス数 | INT | NOT NULL | DEFAULT 1 |

### 3.3 標準棚割 (Standard Planogram)

#### 3.3.1 standard_planograms (標準棚割ヘッダ)
特定のFMT（業態）や基準店舗向けの標準パターン。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | 標準棚割ID | VARCHAR(36) | PK | UUID |
| name | 名称 | VARCHAR(100) | NOT NULL | |
| fmt | 適用FMT | VARCHAR(20) | NOT NULL | |
| base_store_id | 基準店舗ID | VARCHAR(36) | FK(stores) | 参考にした店舗サイズ |
| width | 総幅 | DECIMAL(8,2) | NOT NULL | |
| height | 総高さ | DECIMAL(8,2) | NOT NULL | |
| shelf_count | 総段数 | INT | NOT NULL | |
| created_at | 作成日時 | DATETIME | NOT NULL | |
| updated_at | 更新日時 | DATETIME | NOT NULL | |

#### 3.3.2 standard_planogram_blocks (標準棚割ブロック配置)
標準棚割を構成するブロックの配置情報。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | ID | VARCHAR(36) | PK | UUID |
| standard_planogram_id | 標準棚割ID | VARCHAR(36) | FK | |
| block_id | ブロックID | VARCHAR(36) | FK(shelf_blocks) | |
| position_x | 横位置 | DECIMAL(8,2) | NOT NULL | 棚割全体での左端からの位置 |
| position_y | 縦位置 | DECIMAL(8,2) | NOT NULL | |

#### 3.3.3 standard_planogram_products (標準棚割展開商品)
ブロックを展開した後の全商品リスト（パフォーマンス用のキャッシュ、または個別調整用）。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | ID | VARCHAR(36) | PK | UUID |
| standard_planogram_id | 標準棚割ID | VARCHAR(36) | FK | |
| product_id | 商品ID | VARCHAR(36) | FK(products) | |
| shelf_index | 段位置 | INT | NOT NULL | |
| position_x | 横位置 | DECIMAL(8,2) | NOT NULL | 全体座標での位置 |
| face_count | フェイス数 | INT | NOT NULL | |

### 3.4 個店棚割 (Store Planogram)

#### 3.4.1 store_planograms (個店棚割ヘッダ)
各店舗に適用された棚割の実体。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | 個店棚割ID | VARCHAR(36) | PK | UUID |
| store_id | 店舗ID | VARCHAR(36) | FK(stores) | |
| standard_planogram_id | 親標準棚割ID | VARCHAR(36) | FK | どの標準を元に生成されたか |
| status | ステータス | VARCHAR(20) | NOT NULL | 'pending', 'synced', 'error' |
| created_at | 作成日時 | DATETIME | NOT NULL | |
| updated_at | 更新日時 | DATETIME | NOT NULL | |
| synced_at | 同期日時 | DATETIME | | 最後に標準と同期した日時 |

#### 3.4.2 store_planogram_products (個店棚割商品配置)
自動生成（カット/拡張）後の最終的な商品配置。

| カラム名 | 論理名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **id** | ID | VARCHAR(36) | PK | UUID |
| store_planogram_id | 個店棚割ID | VARCHAR(36) | FK | |
| product_id | 商品ID | VARCHAR(36) | FK(products) | |
| shelf_index | 段位置 | INT | NOT NULL | |
| position_x | 横位置 | DECIMAL(8,2) | NOT NULL | |
| face_count | フェイス数 | INT | NOT NULL | 調整後のフェイス数 |
| is_auto_generated | 自動生成フラグ | BOOLEAN | DEFAULT FALSE | 自動ロジックで追加されたか |
| is_cut | カットフラグ | BOOLEAN | DEFAULT FALSE | 本来あるべきだがカットされた場合(レコードを残すか、statusで管理するかは実装依存だが、ここでは配置されているもののみとするならFALSE、履歴ならTRUE) |

## 4. ビュー定義 (Views)

### 4.1 view_store_planogram_summary
店舗ごとの棚割適用状況と商品数を一覧化するビュー。

```sql
CREATE VIEW view_store_planogram_summary AS
SELECT 
    sp.id AS planogram_id,
    s.id AS store_id,
    s.name AS store_name,
    s.fmt AS store_fmt,
    std.name AS base_standard_planogram_name,
    sp.status,
    COUNT(spp.id) AS total_products,
    SUM(spp.face_count) AS total_faces,
    sp.updated_at
FROM store_planograms sp
JOIN stores s ON sp.store_id = s.id
JOIN standard_planograms std ON sp.standard_planogram_id = std.id
LEFT JOIN store_planogram_products spp ON sp.id = spp.store_planogram_id
GROUP BY sp.id, s.id, s.name, s.fmt, std.name, sp.status, sp.updated_at;
```

### 4.2 view_product_placement_stats
商品ごとの採用店舗数（配下率）などの分析用ビュー。

```sql
CREATE VIEW view_product_placement_stats AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.jan,
    COUNT(DISTINCT spp.store_planogram_id) AS placement_store_count,
    SUM(spp.face_count) AS total_faces_across_stores
FROM products p
LEFT JOIN store_planogram_products spp ON p.id = spp.product_id
GROUP BY p.id, p.name, p.jan;
```
