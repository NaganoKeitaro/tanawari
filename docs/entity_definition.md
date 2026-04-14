# Entity Definition

## 1. Entity List
| entity_id | entity_name | description |
|-----------|------------|-------------|
| ENT-001 | Product | 商品マスタ。JAN・寸法・売上ランク・8階層分類・分析指標を持つ |
| ENT-002 | Store | 店舗マスタ。店舗コード・FMT・地域を持つ |
| ENT-003 | Fixture | 什器マスタ。寸法・段数・什器タイプを持つ |
| ENT-004 | ProductHierarchy | 商品階層マスタ。8階層の商品分類体系を定義する |
| ENT-005 | StoreFixturePlacement | 店舗什器配置。店舗フロア上の什器の位置・方向・ゾーンを管理する |
| ENT-006 | ShelfBlock | 棚ブロック。商品配置のテンプレートとなる再利用可能なグループ |
| ENT-007 | ProductPlacement | ブロック内商品配置。ブロック内の各段における商品の位置とフェイス数 |
| ENT-008 | StandardPlanogram | 標準棚割。FMT単位の基準棚割定義 |
| ENT-009 | StandardPlanogramBlock | 標準棚割ブロック配置。標準棚割内のブロックの位置 |
| ENT-010 | StandardPlanogramProduct | 標準棚割商品。標準棚割内の展開済み商品配置 |
| ENT-011 | StorePlanogram | 個店棚割。標準棚割から自動生成された店舗固有の棚割 |
| ENT-012 | StorePlanogramProduct | 個店棚割商品。個店棚割内の商品配置（自動生成フラグ・カットフラグ付き） |
| ENT-013 | HierarchyPlacement | 階層配置。棚ブロック・標準棚割・個店棚割内の商品階層の配置情報 |

## 2. Entity Detail

### ENT-001
- name: Product
- description: 商品の基本情報・寸法・売上ランク・組織階層分類・分析指標を管理するマスタエンティティ

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| jan | string | no | JANコード（自社商品等はJANなしも可） |
| name | string | yes | 商品名 |
| width | number | yes | 幅（mm） |
| height | number | yes | 高さ（mm） |
| depth | number | yes | 奥行き（mm） |
| category | string | yes | カテゴリ名 |
| imageUrl | string | no | 商品画像URL |
| salesRank | number | yes | 売上ランク（1-100、1が最高） |
| sales | number | no | 売上金額 |
| grossProfit | number | no | 粗利金額 |
| traffic | number | no | 客数 |
| quantity | number | no | 販売数量 |
| spendPerCustomer | number | no | 客単価 |
| divisionCode | string | no | 事業部コード |
| divisionName | string | no | 事業部名 |
| divisionSubCode | string | no | ディビジョンコード |
| divisionSubName | string | no | ディビジョン名 |
| lineCode | string | no | ラインコード |
| lineName | string | no | ライン名 |
| departmentCode | string | no | 部門コード |
| departmentName | string | no | 部門名 |
| categoryCode | string | no | カテゴリコード |
| categoryName | string | no | カテゴリ名（階層） |
| subCategoryCode | string | no | サブカテゴリコード |
| subCategoryName | string | no | サブカテゴリ名 |
| segmentCode | string | no | セグメントコード |
| segmentName | string | no | セグメント名 |
| subSegmentCode | string | no | サブセグメントコード |
| subSegmentName | string | no | サブセグメント名 |
| createdAt | string | yes | 作成日時 |
| updatedAt | string | yes | 更新日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| ProductPlacement | 1:N | 商品は複数のブロック内配置を持つ |
| StandardPlanogramProduct | 1:N | 商品は複数の標準棚割に配置される |
| StorePlanogramProduct | 1:N | 商品は複数の個店棚割に配置される |

### ENT-002
- name: Store
- description: 店舗の基本情報を管理するマスタエンティティ。FMTと地域で分類される

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| code | string | yes | 店舗コード（FMTプレフィックス＋4桁番号、自動採番、UNIQUE） |
| name | string | yes | 店舗名 |
| fmt | FMT | yes | フォーマットタイプ（MEGA/SuC/SMART/GO/FC） |
| region | Region | yes | 地域（北海道/東北/関東/中部/近畿/中国・四国/九州/全地域） |
| createdAt | string | yes | 作成日時 |
| updatedAt | string | yes | 更新日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| StoreFixturePlacement | 1:N | 店舗は複数の什器配置を持つ |
| StorePlanogram | 1:N | 店舗は複数の個店棚割を持つ |
| StandardPlanogram | N:1 | 店舗は標準棚割の基準店舗になりうる |

### ENT-003
- name: Fixture
- description: 什器の定義情報を管理するマスタエンティティ

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| name | string | yes | 什器名 |
| width | number | yes | 幅（mm） |
| height | number | yes | 高さ（mm） |
| depth | number | yes | 奥行き（mm） |
| shelfCount | number | yes | 段数 |
| fixtureType | FixtureType | yes | 什器タイプ（multi-tier/flat-refrigerated/flat-frozen/end-cap-refrigerated/end-cap-frozen/gondola） |
| manufacturer | string | no | メーカー名 |
| modelNumber | string | no | 型番 |
| installDate | string | no | 設置日 |
| warrantyEndDate | string | no | 保証期限 |
| createdAt | string | yes | 作成日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| StoreFixturePlacement | 1:N | 什器は複数の店舗に配置される |

### ENT-004
- name: ProductHierarchy
- description: 商品分類の8階層構造を定義するマスタエンティティ

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| divisionCode | string | no | 事業部コード |
| divisionName | string | no | 事業部名 |
| divisionSubCode | string | no | ディビジョンコード |
| divisionSubName | string | no | ディビジョン名 |
| lineCode | string | no | ラインコード |
| lineName | string | no | ライン名 |
| departmentCode | string | no | 部門コード |
| departmentName | string | no | 部門名 |
| categoryCode | string | no | カテゴリコード |
| categoryName | string | no | カテゴリ名 |
| subCategoryCode | string | no | サブカテゴリコード |
| subCategoryName | string | no | サブカテゴリ名 |
| segmentCode | string | no | セグメントコード |
| segmentName | string | no | セグメント名 |
| subSegmentCode | string | no | サブセグメントコード |
| subSegmentName | string | no | サブセグメント名 |
| createdAt | string | yes | 作成日時 |
| updatedAt | string | yes | 更新日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| Product | 1:N | 階層は複数の商品に適用される（コードベースの参照） |

### ENT-005
- name: StoreFixturePlacement
- description: 店舗フロア上における什器の配置情報を管理するエンティティ

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| storeId | string (UUID) | yes | 店舗ID（FK） |
| fixtureId | string (UUID) | yes | 什器ID（FK） |
| positionX | number | yes | X座標（mm、絶対位置） |
| positionY | number | yes | Y座標（mm、絶対位置） |
| order | number | yes | 配置順序 |
| direction | number | no | 回転角度（0/90/180/270） |
| zone | ZoneType | no | ゾーン（多段/平台冷蔵/平台冷蔵エンド/平台冷凍/平台冷凍エンド） |
| label | string | no | カスタムラベル |
| createdAt | string | yes | 作成日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| Store | N:1 | 配置は1つの店舗に属する |
| Fixture | N:1 | 配置は1つの什器を参照する |

### ENT-006
- name: ShelfBlock
- description: 棚割の構成単位。商品のグルーピングテンプレートとして再利用される

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| name | string | yes | ブロック名 |
| description | string | no | 説明 |
| blockType | string | no | ブロックタイプ（multi-tier/flat） |
| width | number | yes | 幅（mm） |
| height | number | yes | 高さ（mm） |
| shelfCount | number | yes | 段数 |
| createdAt | string | yes | 作成日時 |
| updatedAt | string | yes | 更新日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| ProductPlacement | 1:N | ブロックは複数の商品配置を持つ |
| HierarchyPlacement | 1:N | ブロックは複数の階層配置を持つ |
| StandardPlanogramBlock | 1:N | ブロックは複数の標準棚割で使用される |

### ENT-007
- name: ProductPlacement
- description: 棚ブロック内における商品の配置情報

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| productId | string (UUID) | yes | 商品ID（FK） |
| shelfIndex | number | yes | 段インデックス（0始まり） |
| positionX | number | yes | 段内X座標（mm） |
| faceCount | number | yes | フェイス数（繰り返し数） |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| ShelfBlock | N:1 | 配置は1つのブロックに属する |
| Product | N:1 | 配置は1つの商品を参照する |

### ENT-008
- name: StandardPlanogram
- description: FMT単位の基準棚割。個店展開の元となるテンプレート

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| name | string | yes | 棚割名 |
| fmt | FMT | yes | フォーマットタイプ |
| baseStoreId | string (UUID) | yes | 基準店舗ID（FK） |
| fixtureType | FixtureType | no | 什器タイプ |
| width | number | yes | 幅（mm） |
| height | number | yes | 高さ（mm） |
| shelfCount | number | yes | 段数 |
| startDate | string | no | 適用開始日 |
| endDate | string | no | 適用終了日 |
| description | string | no | 説明 |
| createdAt | string | yes | 作成日時 |
| updatedAt | string | yes | 更新日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| Store | N:1 | 基準店舗を参照する |
| StandardPlanogramBlock | 1:N | 複数のブロック配置を持つ |
| StandardPlanogramProduct | 1:N | 複数の展開済み商品配置を持つ |
| HierarchyPlacement | 1:N | 複数の階層配置を持つ |
| StorePlanogram | 1:N | 複数の個店棚割の元となる |

### ENT-009
- name: StandardPlanogramBlock
- description: 標準棚割内におけるブロックの配置情報

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| standardPlanogramId | string (UUID) | yes | 標準棚割ID（FK） |
| blockId | string (UUID) | yes | ブロックID（FK） |
| positionX | number | yes | X座標（mm） |
| positionY | number | yes | Y座標（mm） |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| StandardPlanogram | N:1 | 1つの標準棚割に属する |
| ShelfBlock | N:1 | 1つのブロックを参照する |

### ENT-010
- name: StandardPlanogramProduct
- description: 標準棚割内に展開された個別商品の配置情報

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| standardPlanogramId | string (UUID) | yes | 標準棚割ID（FK） |
| productId | string (UUID) | yes | 商品ID（FK） |
| shelfIndex | number | yes | 段インデックス（0始まり） |
| positionX | number | yes | 段内X座標（mm） |
| faceCount | number | yes | フェイス数 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| StandardPlanogram | N:1 | 1つの標準棚割に属する |
| Product | N:1 | 1つの商品を参照する |

### ENT-011
- name: StorePlanogram
- description: 標準棚割から自動生成された店舗固有の棚割。ステータスと警告を持つ

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| storeId | string (UUID) | yes | 店舗ID（FK） |
| standardPlanogramId | string (UUID) | yes | 元となる標準棚割ID（FK） |
| width | number | yes | 幅（mm） |
| height | number | yes | 高さ（mm） |
| shelfCount | number | yes | 段数 |
| status | PlanogramStatus | yes | ステータス（pending/generated/warning/error/synced） |
| warnings | string[] | yes | 警告メッセージ配列 |
| syncedAt | string | no | 最終同期日時 |
| createdAt | string | yes | 作成日時 |
| updatedAt | string | yes | 更新日時 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| Store | N:1 | 1つの店舗に属する |
| StandardPlanogram | N:1 | 1つの標準棚割を元にする |
| StorePlanogramProduct | 1:N | 複数の商品配置を持つ |
| HierarchyPlacement | 1:N | 複数の階層配置を持つ |

### ENT-012
- name: StorePlanogramProduct
- description: 個店棚割内の商品配置情報。自動生成フラグとカットフラグを持つ

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| storePlanogramId | string (UUID) | yes | 個店棚割ID（FK） |
| productId | string (UUID) | yes | 商品ID（FK） |
| shelfIndex | number | yes | 段インデックス（0始まり） |
| positionX | number | yes | 段内X座標（mm） |
| faceCount | number | yes | フェイス数 |
| isAutoGenerated | boolean | yes | ルールA/B自動適用フラグ |
| isCut | boolean | yes | ルールAカットフラグ |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| StorePlanogram | N:1 | 1つの個店棚割に属する |
| Product | N:1 | 1つの商品を参照する |

### ENT-013
- name: HierarchyPlacement
- description: 棚ブロック・標準棚割・個店棚割内における商品階層の配置情報。カテゴリやセグメントなどの階層レベルで棚の領域を定義する

#### attributes:
| attribute_name | type | required | description |
|----------------|------|----------|-------------|
| id | string (UUID) | yes | 一意識別子 |
| hierarchyLevel | HierarchyLevel | yes | 階層レベル（division〜subSegment） |
| hierarchyCode | string | yes | 階層コード |
| hierarchyName | string | yes | 階層名 |
| shelfIndex | number | yes | 段インデックス（0始まり） |
| positionX | number | yes | 段内X座標（mm） |
| width | number | yes | 幅（mm） |
| faceCount | number | yes | フェイス数 |

#### relationships:
| related_entity | relation_type | description |
|----------------|--------------|-------------|
| ShelfBlock | N:1 | ブロック内階層配置として属する |
| StandardPlanogram | N:1 | 標準棚割内階層配置として属する |
| StorePlanogram | N:1 | 個店棚割内階層配置として属する |
