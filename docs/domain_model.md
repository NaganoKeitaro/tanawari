# Domain Model

## 1. Overview
- description: 棚割管理システムのドメインモデル。マスタデータ集約、棚ブロック集約、標準棚割集約、個店棚割集約、店舗レイアウト集約の5つの集約で構成される。

## 2. Model Structure

### Aggregates
| aggregate_id | root_entity | description |
|--------------|------------|-------------|
| AGG-001 | Product | 商品マスタ集約。商品の基本情報・階層分類・分析指標を管理する |
| AGG-002 | Store | 店舗マスタ集約。店舗の基本情報を管理する |
| AGG-003 | Fixture | 什器マスタ集約。什器の定義情報を管理する |
| AGG-004 | ProductHierarchy | 商品階層集約。8階層の分類体系を管理する |
| AGG-005 | ShelfBlock | 棚ブロック集約。ブロック定義と内部の商品配置を管理する |
| AGG-006 | StandardPlanogram | 標準棚割集約。FMT基準の棚割定義・ブロック配置・展開済み商品配置を管理する |
| AGG-007 | StorePlanogram | 個店棚割集約。店舗固有の棚割・商品配置・ステータス・警告を管理する |
| AGG-008 | StoreFixturePlacement | 店舗レイアウト集約。店舗フロア上の什器配置を管理する |

### Entities
| entity_id | aggregate_id | description |
|-----------|-------------|-------------|
| ENT-001 | AGG-001 | Product（集約ルート） |
| ENT-002 | AGG-002 | Store（集約ルート） |
| ENT-003 | AGG-003 | Fixture（集約ルート） |
| ENT-004 | AGG-004 | ProductHierarchy（集約ルート） |
| ENT-005 | AGG-008 | StoreFixturePlacement（集約ルート） |
| ENT-006 | AGG-005 | ShelfBlock（集約ルート） |
| ENT-007 | AGG-005 | ProductPlacement（ブロック内エンティティ） |
| ENT-013a | AGG-005 | HierarchyPlacement（ブロック内階層配置エンティティ） |
| ENT-008 | AGG-006 | StandardPlanogram（集約ルート） |
| ENT-009 | AGG-006 | StandardPlanogramBlock（集約内エンティティ） |
| ENT-010 | AGG-006 | StandardPlanogramProduct（集約内エンティティ） |
| ENT-013b | AGG-006 | HierarchyPlacement（標準棚割内階層配置エンティティ） |
| ENT-011 | AGG-007 | StorePlanogram（集約ルート） |
| ENT-012 | AGG-007 | StorePlanogramProduct（集約内エンティティ） |
| ENT-013c | AGG-007 | HierarchyPlacement（個店棚割内階層配置エンティティ） |

### Value Objects
| vo_id | description |
|-------|-------------|
| VO-001 | FMT - フォーマットタイプ（MEGA/SuC/SMART/GO/FC） |
| VO-002 | Region - 地域（北海道/東北/関東/中部/近畿/中国・四国/九州/全地域） |
| VO-003 | FixtureType - 什器タイプ（multi-tier/flat-refrigerated/flat-frozen/end-cap-refrigerated/end-cap-frozen/gondola） |
| VO-004 | ZoneType - ゾーン（多段/平台冷蔵/平台冷蔵エンド/平台冷凍/平台冷凍エンド） |
| VO-005 | PlanogramStatus - 棚割ステータス（pending/generated/warning/error/synced） |
| VO-006 | Dimension - 寸法（width/height/depth、単位:mm） |
| VO-007 | Position - 座標（positionX/positionY、単位:mm） |
| VO-008 | SalesRank - 売上ランク（1-100、1が最高） |
| VO-009 | HeatmapMetric - ヒートマップ指標（sales/grossProfit/quantity/traffic/spendPerCustomer） |
| VO-010 | HeatmapLevel - ヒートマップレベル（jan/hierarchy/block/planogram） |
| VO-011 | ProductColor - 商品カテゴリ色（bg/border/text） |
| VO-012 | HierarchyLevel - 階層レベル（division/divisionSub/line/department/category/subCategory/segment/subSegment） |

## 3. Rules

### invariant:
- INV-001: 商品の寸法（幅・高さ・奥行き）は正の数でなければならない
- INV-002: 売上ランクは1-100の範囲でなければならない（1が最高）
- INV-003: 商品配置のshelfIndexはブロック/棚割のshelfCount未満でなければならない
- INV-004: 商品配置のフェイス数は1以上でなければならない
- INV-005: 店舗コードはシステム内でユニークでなければならない
- INV-006: 什器の段数は1以上でなければならない
- INV-007: 個店棚割は必ず1つの標準棚割を参照しなければならない
- INV-008: 店舗什器配置の回転角度は0/90/180/270のいずれかでなければならない

### business_rule:
- BR-001: ルールA（カット処理）- 店舗什器幅 < 標準棚割幅の場合、売上ランクの低い商品から順にフェイス数削減→商品削除を行い、棚幅に収まるよう調整する
- BR-002: ルールB（拡張処理）- 店舗什器幅 > 標準棚割幅の場合、売上ランク上位10商品のフェイス数を2倍、11位以降を1.5倍にして棚を充填する。超過時はリバートする
- BR-003: ルールC（同期処理）- 標準棚割の最新状態を取得し、ルールA/Bを再適用して個店棚割を更新する
- BR-004: ルールD（商品連結）- 同一商品を同一段内に隣接配置する場合、フェイス数を統合する
- BR-005: 棚幅オーバーフロー禁止 - 段内の商品幅合計（幅×フェイス数の総和）が棚割幅を超えてはならない
- BR-006: AABB衝突検知 - 店舗フロア上の什器配置で重なりを許可しない
- BR-007: 店舗コード自動採番 - FMTプレフィックス＋4桁連番で自動生成する
- BR-008: 表示スケール - 1mm = 0.3px（SCALE定数）で棚割を画面表示する
- BR-009: 単位系 - 全寸法をmm単位で内部管理し、表示時に「mm（尺）」の両建て表示を行う（1尺=300mm）
- BR-010: ルールE（非直線棚配置）- 棚間にドアがある場合やL字・コの字配置など棚が直線に並んでいない場合、自動生成ではブロックを分割せず折り返しも行わない。什器幅の合計値で直線として処理する。非直線レイアウト固有の調整が必要な場合はユーザーが個店棚割編集で手動修正する

## 4. Relationships
| from | to | relation | description |
|------|-----|----------|-------------|
| Product | ProductPlacement | 1:N | 商品は複数のブロック配置に使用される |
| Product | StandardPlanogramProduct | 1:N | 商品は複数の標準棚割に配置される |
| Product | StorePlanogramProduct | 1:N | 商品は複数の個店棚割に配置される |
| Store | StoreFixturePlacement | 1:N | 店舗は複数の什器配置を持つ |
| Store | StorePlanogram | 1:N | 店舗は複数の個店棚割を持つ |
| Store | StandardPlanogram | 1:N | 店舗は標準棚割の基準店舗になりうる |
| Fixture | StoreFixturePlacement | 1:N | 什器は複数の店舗に配置される |
| ShelfBlock | ProductPlacement | 1:N | ブロックは複数の商品配置を持つ |
| ShelfBlock | HierarchyPlacement | 1:N | ブロックは複数の階層配置を持つ |
| ShelfBlock | StandardPlanogramBlock | 1:N | ブロックは複数の標準棚割で使用される |
| StandardPlanogram | StandardPlanogramBlock | 1:N | 標準棚割は複数のブロック配置を持つ |
| StandardPlanogram | StandardPlanogramProduct | 1:N | 標準棚割は複数の展開済み商品を持つ |
| StandardPlanogram | HierarchyPlacement | 1:N | 標準棚割は複数の階層配置を持つ |
| StandardPlanogram | StorePlanogram | 1:N | 標準棚割は複数の個店棚割の元となる |
| StorePlanogram | StorePlanogramProduct | 1:N | 個店棚割は複数の商品配置を持つ |
| StorePlanogram | HierarchyPlacement | 1:N | 個店棚割は複数の階層配置を持つ |
