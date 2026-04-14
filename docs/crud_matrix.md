# CRUD Matrix

## Matrix
| entity \ function | BF-001 商品マスタ管理 | BF-002 店舗マスタ管理 | BF-003 什器マスタ管理 | BF-004 商品階層管理 | BF-005 シードデータ生成 | BF-006 棚ブロック編集 | BF-007 標準棚割設計 | BF-008 標準棚割複製 | BF-009 個店棚割一括生成 | BF-010 個店棚割手動調整 | BF-011 個店棚割同期 | BF-012 ステータス管理 | BF-013 什器配置管理 | BF-014 KPIダッシュ | BF-015 ヒートマップ | BF-016 指示書出力 | BF-017 インポート | BF-018 エクスポート |
|------------------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Product | CRUD | - | - | - | C | R | R | - | R | R | R | - | - | R | R | R | CU | R |
| Store | - | CRUD | - | - | C | - | R | - | R | R | - | - | R | R | - | R | - | - |
| Fixture | - | - | CRUD | - | C | - | R | - | - | - | - | - | R | - | - | R | - | - |
| ProductHierarchy | - | - | - | CRUD | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| StoreFixturePlacement | - | - | - | - | - | - | - | - | R | - | - | - | CRUD | - | - | R | - | - |
| ShelfBlock | - | - | - | - | C | CRUD | R | R | - | - | - | - | - | - | R | R | - | - |
| ProductPlacement | - | - | - | - | C | CRUD | R | R | - | - | - | - | - | - | - | R | - | - |
| StandardPlanogram | - | - | - | - | C | - | CRUD | CR | R | - | R | - | - | - | R | R | - | - |
| StandardPlanogramBlock | - | - | - | - | - | - | CRUD | CR | - | - | - | - | - | - | - | - | - | - |
| StandardPlanogramProduct | - | - | - | - | - | - | CRUD | CR | R | - | R | - | - | - | R | R | - | - |
| StorePlanogram | - | - | - | - | - | - | - | - | CRU | RU | RU | RU | - | - | R | R | - | - |
| StorePlanogramProduct | - | - | - | - | - | - | - | - | CRU | CRUD | CRU | - | - | - | R | R | - | - |
| HierarchyPlacement (Block) | - | - | - | - | - | CRUD | R | R | - | - | - | - | - | - | - | R | - | - |
| HierarchyPlacement (Standard) | - | - | - | - | - | - | CRUD | CR | R | - | R | - | - | - | R | R | - | - |
| HierarchyPlacement (Store) | - | - | - | - | - | - | - | - | CRU | R | CRU | - | - | - | R | R | - | - |
