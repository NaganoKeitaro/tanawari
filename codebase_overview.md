# コードベース概要ドキュメント

> 作成日: 2026-03-09
> 最終更新日: 2026-03-13
> 対象プロジェクト: 棚割管理システム（tanawari）

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構造](#3-ディレクトリ構造)
4. [設定ファイル](#4-設定ファイル)
5. [エントリーポイント](#5-エントリーポイント)
6. [データ層（data/）](#6-データ層data)
7. [サービス層（services/）](#7-サービス層services)
8. [ユーティリティ（utils/）](#8-ユーティリティutils)
9. [共通コンポーネント（components/common/）](#9-共通コンポーネントcomponentscommon)
10. [レイアウトコンポーネント（components/layout/）](#10-レイアウトコンポーネントcomponentslayout)
11. [ダッシュボードコンポーネント（components/dashboard/）](#11-ダッシュボードコンポーネントcomponentsdashboard)
12. [マスタコンポーネント（components/masters/）](#12-マスタコンポーネントcomponentsmasters)
13. [棚割コンポーネント（components/planogram/）](#13-棚割コンポーネントcomponentsplanogram)
14. [ページコンポーネント（pages/）](#14-ページコンポーネントpages)
15. [ルーティング一覧](#15-ルーティング一覧)
16. [主要ドメイン型定義](#16-主要ドメイン型定義)
17. [データフロー・操作フロー](#17-データフロー操作フロー)

---

## 1. プロジェクト概要

小売業向けの**棚割（プラノグラム）業務支援システム**。
商品マスタ・店舗マスタの管理から、FMT（店舗フォーマット）別の標準棚割作成、
個店の物理的棚幅に応じた自動調整、分析・指示書生成までを一気通貫で支援する。

---

## 2. 技術スタック

| 区分 | 技術 | バージョン |
|------|------|-----------|
| フロントエンド | React | 19.2.0 |
| 言語 | TypeScript | 5.x |
| ビルドツール | Vite | 6.x |
| ルーティング | React Router DOM | 7.11.0 |
| D&D | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 |
| バックエンド | Supabase (PostgreSQL) | 2.97.0 |
| Excel処理 | xlsx | 0.18.5 |
| スタイル | インラインスタイル（CSS-in-JS） | - |
| デプロイ | Vercel | - |

ローカル開発時は Supabase の代わりに `localStorage` をフォールバックとして使用。

---

## 3. ディレクトリ構造

```
tanawari/
├── index.html                          # HTMLエントリー
├── package.json                        # 依存関係・スクリプト
├── vite.config.ts                      # Vite設定
├── tsconfig.json / tsconfig.app.json   # TypeScript設定
├── eslint.config.js                    # ESLint設定
├── vercel.json                         # Vercelデプロイ設定（SPA用リライト）
├── supabase/
│   ├── schema.sql                      # メインスキーマ（12テーブル）
│   ├── schema_hierarchy.sql            # 商品階層スキーマ
│   └── migrations/
│       ├── 20260227_cm_to_mm.sql       # 単位変換マイグレーション
│       ├── 20260309_add_missing_columns.sql  # カラム追加
│       └── 20260311_fix_shelf_block_decimal_precision.sql  # decimal精度修正
├── docs/
│   ├── deployment.md                   # デプロイガイド
│   ├── operation_manual.md             # 操作マニュアル
│   ├── images/                         # 図表画像
│   └── diagrams/                       # Mermaidソース
└── src/
    ├── main.tsx                        # エントリーポイント
    ├── App.tsx                         # ルーティング定義（14ルート）
    ├── index.css                       # グローバルスタイル
    ├── data/
    │   ├── supabaseClient.ts           # Supabaseクライアント初期化
    │   ├── seedData.ts                 # サンプルデータ生成
    │   ├── types/
    │   │   ├── index.ts                # 全ドメイン型定義・定数
    │   │   └── productHierarchy.ts     # 商品階層型定義
    │   └── repositories/
    │       ├── baseRepository.ts       # IRepository<T>インターフェース
    │       ├── localStorageRepository.ts  # localStorage実装
    │       ├── supabaseRepository.ts   # Supabase実装
    │       └── repositoryFactory.ts    # 環境自動判定ファクトリー
    ├── services/
    │   └── automationService.ts        # 棚割自動生成ロジック
    ├── utils/
    │   ├── aggregationUtils.ts         # 売上・分析データ集計
    │   ├── excelUtils.ts               # Excel/CSV入出力
    │   ├── heatmapUtils.ts             # ヒートマップ色計算
    │   ├── hierarchyHelpers.tsx        # 階層表示ヘルパー
    │   ├── hierarchyUtils.ts           # 階層テンプレート生成
    │   ├── metricsGenerator.ts         # デモ用メトリクス生成
    │   ├── productColorUtils.ts        # カテゴリ色分け（30色パレット）
    │   └── unitConverter.ts            # mm↔尺 単位変換
    ├── components/
    │   ├── common/
    │   │   ├── Modal.tsx               # 汎用モーダル
    │   │   ├── ProductTooltip.tsx       # 商品ツールチップ
    │   │   ├── UnitInput.tsx           # mm/尺切り替え入力
    │   │   └── UnitDisplay.tsx         # mm+尺同時表示
    │   ├── layout/
    │   │   ├── AppLayout.tsx           # 共通レイアウト（サイドバー）
    │   │   ├── StoreLayoutEditor.tsx   # 店舗レイアウト編集
    │   │   └── StoreLayoutVisualizer.tsx  # 店舗レイアウト表示
    │   ├── dashboard/
    │   │   ├── KPICard.tsx             # KPIカード
    │   │   └── MetricsChart.tsx        # 棒グラフ・円グラフ
    │   ├── masters/
    │   │   ├── ExcelImportModal.tsx    # Excelインポート
    │   │   ├── BulkEditModal.tsx       # 一括編集
    │   │   └── HierarchyImportModal.tsx  # 階層CSVインポート
    │   └── planogram/
    │       └── PlanogramVisualizer.tsx # ヒートマップビジュアライザ
    └── pages/
        ├── HomePage.tsx                # ホーム
        ├── Dashboard.tsx               # KPIダッシュボード
        ├── Analytics.tsx               # 詳細分析
        ├── InstructionSheet.tsx         # 棚割指示書
        ├── BulkDelete.tsx              # データ一括削除
        ├── masters/
        │   ├── ProductMaster.tsx        # 商品マスタ
        │   ├── ProductHierarchyMaster.tsx  # 商品階層マスタ
        │   ├── FixtureMaster.tsx        # 什器マスタ
        │   ├── StoreMaster.tsx          # 店舗マスタ
        │   └── StoreFixtureMaster.tsx   # 店舗棚尺マスタ
        ├── blocks/
        │   └── ShelfBlockEditor.tsx     # 棚ブロックエディタ
        └── planogram/
            ├── StandardPlanogramEditor.tsx  # FMT標準棚割
            ├── StorePlanogramBatch.tsx      # 一括生成
            └── StorePlanogramEditor.tsx     # 個店棚割編集
```

---

## 4. 設定ファイル

### [package.json](package.json)
- **主要スクリプト**: `dev`（開発サーバー）, `build`（`tsc -b && vite build`）, `lint`, `preview`
- **主要依存**:
  - `react` / `react-dom` 19.2.0
  - `react-router-dom` 7.11.0
  - `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2
  - `@supabase/supabase-js` 2.97.0
  - `xlsx` 0.18.5

### [vite.config.ts](vite.config.ts)
- `@vitejs/plugin-react` プラグイン適用のみ（シンプル構成）

### [tsconfig.app.json](tsconfig.app.json)
- `target: ES2022`, `strict: true`, `jsx: react-jsx`

### [vercel.json](vercel.json)
- 全パスを `index.html` にリライト（SPAルーティング対応）

### Supabaseスキーマ
- `supabase/schema.sql`: メインテーブル定義（12テーブル）
- `supabase/schema_hierarchy.sql`: 商品階層テーブル
- `supabase/migrations/`: 3つのマイグレーションファイル

---

## 5. エントリーポイント

### [src/main.tsx](src/main.tsx)
- `ReactDOM.createRoot()` で `<App />` をマウント。`StrictMode` 有効。

### [src/App.tsx](src/App.tsx)
- `BrowserRouter` + `Routes` で全14ルートを定義
- 全ページを `<AppLayout>` でラップ（共通ナビゲーション）

### [src/index.css](src/index.css)
- リセットCSS、ボディフォント設定、基本レイアウト

---

## 6. データ層（data/）

### [src/data/supabaseClient.ts](src/data/supabaseClient.ts)
- 環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` から `createClient()` でクライアント生成

### [src/data/seedData.ts](src/data/seedData.ts)
- `generateSeedStores()` — 18店舗のサンプルデータ（九州地方中心）
- FMTプレフィックス（MEGA, SuC, SMART, GO, FC）+ 4桁番号でコード自動生成

### [src/data/types/index.ts](src/data/types/index.ts)
- **定数**:
  - `REGIONS`: 地域マスタ（北海道, 東北, 関東, 中部, 近畿, 中国・四国, 九州, 全地域）
  - `FMTS`: 店舗フォーマット（MEGA, SuC, SMART, GO, FC）
  - `FIXTURE_TYPES`: 什器タイプ（multi-tier, flat-refrigerated, flat-frozen, end-cap-refrigerated, end-cap-frozen, gondola）
  - `ZONE_TYPES`: ゾーン（多段, 平台冷蔵, 平台冷蔵エンド, 平台冷凍, 平台冷凍エンド）
  - `SHAKU_TO_MM = 300`: 1尺 = 300mm
- **主要型**: → [16章](#16-主要ドメイン型定義) 参照

### [src/data/types/productHierarchy.ts](src/data/types/productHierarchy.ts)
- `HierarchyEntry` 型（16フィールド: division/divisionSub/line/department/category/subCategory/segment/subSegmentの各コード・名称）
- `HierarchyLevel` 型（8レベル）
- `HIERARCHY_HEADERS`, `HIERARCHY_KEYS` 定数

### [src/data/repositories/baseRepository.ts](src/data/repositories/baseRepository.ts)
```typescript
interface IRepository<T> {
    getAll(): Promise<T[]>
    getById(id: string): Promise<T | null>
    create(item: Omit<T, 'id'>): Promise<T>
    update(id: string, item: Partial<T>): Promise<T | null>
    delete(id: string): Promise<boolean>
    query(predicate: (item: T) => boolean): Promise<T[]>
}
```

### [src/data/repositories/localStorageRepository.ts](src/data/repositories/localStorageRepository.ts)
- `LocalStorageRepository<T>` が `IRepository<T>` を実装。IDは `crypto.randomUUID()` で自動生成。

### [src/data/repositories/supabaseRepository.ts](src/data/repositories/supabaseRepository.ts)
- `SupabaseRepository<T>` が `IRepository<T>` を実装。camelCase ↔ snake_case 自動変換。

### [src/data/repositories/repositoryFactory.ts](src/data/repositories/repositoryFactory.ts)
- `VITE_SUPABASE_URL` 設定済み → `SupabaseRepository`、未設定 → `LocalStorageRepository`
- **エクスポート**: `productRepository`, `storeRepository`, `fixtureRepository`, `storeFixturePlacementRepository`, `shelfBlockRepository`, `standardPlanogramRepository`, `storePlanogramRepository`, `productHierarchyRepository`

---

## 7. サービス層（services/）

### [src/services/automationService.ts](src/services/automationService.ts)
- **エクスポート関数**:
  - `generateStorePlanogram(storeId, standardPlanogram)` — 1店舗分の個店棚割を生成
  - `batchGenerateStorePlanograms(standardPlanogram, onProgress?, storeIds?)` — 複数店舗を一括生成
  - `syncStorePlanogram(storePlanogramId)` — 個店棚割を最新の標準棚割に同期
- **内部関数**:
  - `applyRuleA(products, productMaster, targetWidth)` — カットロジック
  - `applyRuleB(products, productMaster, targetWidth, standardWidth)` — 拡張ロジック

| ルール | 条件 | 処理内容 |
|--------|------|----------|
| ルールA（カット） | 店舗棚幅 < 標準棚幅 | 売上ランク低い順にフェイス削減（最小1）→ 商品カット |
| ルールB（拡張） | 店舗棚幅 > 標準棚幅 | 1st: 上位10商品を2倍、2nd: 残りを1.5倍 |
| ルールC（同期） | 親棚割更新時 | ルールA/Bを再適用して再生成 |

---

## 8. ユーティリティ（utils/）

### [src/utils/unitConverter.ts](src/utils/unitConverter.ts)
- `mmToShaku(mm)`, `shakuToMm(shaku)`, `formatWithBothUnits(mm)` → "1200mm (4.0尺)"
- `parseInputToMm(input)` — "1200mm", "4尺", "1200" 等の複数フォーマットをパース

### [src/utils/productColorUtils.ts](src/utils/productColorUtils.ts)
- `initProductColorMap(categories)` — カテゴリリストで30色パレットを初期化
- `getProductColor(category)` — カテゴリに応じた `{ bg, border, text }` を返す
- `resetProductColorMap()` — 色マップをリセット

### [src/utils/aggregationUtils.ts](src/utils/aggregationUtils.ts)
- `aggregateMetrics(products)` — 売上合計・粗利・客数等を集計
- `aggregateByCategory(products)` — カテゴリ別集計
- `aggregateByHierarchy(products, level)` — 階層レベル別集計
- `aggregateBySalesRank(products)` — ランク別（トップ/中位/低位）集計
- `calculateProfitMargin(metrics)`, `calculateGrowthRate(current, previous)`

### [src/utils/excelUtils.ts](src/utils/excelUtils.ts)
- `readExcelFile(file)`, `readCSVFile(file)`, `readFile(file)` — ファイル読込
- `mapExcelRowToProduct(row)` — 行データ→Product変換
- `validateProductData(data, existing)`, `categorizeImportData(data, existing)` — バリデーション・分類
- `calculateSalesRank(products)` — 売上金額から1-100ランク自動計算
- `exportProductsToCSV(products)`, `exportSkippedProductsToCSV(skipped)` — CSVエクスポート
- `generateExcelTemplate()` — インポート用テンプレート生成

### [src/utils/heatmapUtils.ts](src/utils/heatmapUtils.ts)
- `calculateHeatmapColor(value, maxValue, minValue?)` — 5段階色（高:赤→低:青）
- `formatMetricValue(value)` — K/M単位フォーマット
- `getJanLevelValue(product, metric)` — 商品単品メトリクス取得
- `aggregateByHierarchy(products, metric, field?)` — 階層別メトリクス集計

### [src/utils/hierarchyUtils.ts](src/utils/hierarchyUtils.ts)
- `generateHierarchyTemplate()` — CSVテンプレートBlob生成
- `mapRowToHierarchyEntry(row)`, `validateHierarchyEntry(entry)` — 変換・バリデーション

### [src/utils/hierarchyHelpers.tsx](src/utils/hierarchyHelpers.tsx)
- 階層レベル表示ロジック、パンくずリスト生成

### [src/utils/metricsGenerator.ts](src/utils/metricsGenerator.ts)
- `generateRandomMetrics()` — ランダムな売上・粗利・客数・客単価
- `generateRandomSize()` — ランダムな商品サイズ
- `calculateMetricsFromQuantity(salesQuantity)` — 数量から各メトリクスを計算

---

## 9. 共通コンポーネント（components/common/）

### [src/components/common/Modal.tsx](src/components/common/Modal.tsx)
- 汎用モーダルダイアログ。Props: `isOpen`, `onClose`, `title`, `size`（sm/md/lg/xl）, `children`
- ESCキー対応、スクロール固定、フェード+スライドアニメーション

### [src/components/common/ProductTooltip.tsx](src/components/common/ProductTooltip.tsx)
- 商品ツールチップ。Props: `productName`, `jan`, `faceCount`, `category?`, `children`
- `cloneElement` でマウスハンドラを注入、`createPortal` でdocument.bodyに描画
- ビューポート上端検出で上/下自動切り替え（`TOOLTIP_HEIGHT = 90`）

### [src/components/common/UnitInput.tsx](src/components/common/UnitInput.tsx)
- mm / 尺 切り替え対応の数値入力。Props: `value`（mm）, `onChange`（mm）, `min`, `max`, `label`

### [src/components/common/UnitDisplay.tsx](src/components/common/UnitDisplay.tsx)
- mm と尺の同時表示。Props: `valueMm`。表示例: `1200mm (4.0尺)`

---

## 10. レイアウトコンポーネント（components/layout/）

### [src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx)
- 左サイドバーにナビゲーションメニュー + `<Outlet />` で各ページを描画

### [src/components/layout/StoreLayoutEditor.tsx](src/components/layout/StoreLayoutEditor.tsx)
- 店舗フロアレイアウト上での什器配置編集UI（2Dグリッド、D&D、回転、ゾーン・ラベル編集）

### [src/components/layout/StoreLayoutVisualizer.tsx](src/components/layout/StoreLayoutVisualizer.tsx)
- 店舗フロアレイアウトの読み取り専用ビジュアル表示

---

## 11. ダッシュボードコンポーネント（components/dashboard/）

### [src/components/dashboard/KPICard.tsx](src/components/dashboard/KPICard.tsx)
- KPI指標カード。Props: `title`, `value`, `unit`, `trend`, `color`

### [src/components/dashboard/MetricsChart.tsx](src/components/dashboard/MetricsChart.tsx)
- 棒グラフ・円グラフ（SVGベース）。Props: `data`, `type`（bar/pie）, `metric`

---

## 12. マスタコンポーネント（components/masters/）

### [src/components/masters/ExcelImportModal.tsx](src/components/masters/ExcelImportModal.tsx)
- Excelインポートモーダル。ファイル選択→プレビュー→バリデーション→インポート

### [src/components/masters/BulkEditModal.tsx](src/components/masters/BulkEditModal.tsx)
- 複数商品一括編集モーダル

### [src/components/masters/HierarchyImportModal.tsx](src/components/masters/HierarchyImportModal.tsx)
- 商品階層CSVインポートモーダル

---

## 13. 棚割コンポーネント（components/planogram/）

### [src/components/planogram/PlanogramVisualizer.tsx](src/components/planogram/PlanogramVisualizer.tsx)
- 棚割のヒートマップビジュアライザー
- 表示モード: `jan`（単品）, `hierarchy`（階層）, `block`（ブロック）, `planogram`（全体）
- カテゴリ色分け表示、商品ツールチップ（JAN・フェイス数）対応

---

## 14. ページコンポーネント（pages/）

### [src/pages/HomePage.tsx](src/pages/HomePage.tsx)
- システム統計カード、店舗マスタ生成ボタン、ワークフロー説明

### [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)
- スコープ選択（全社/個店）、KPIカード、カテゴリ別棒グラフ+円グラフ

### [src/pages/Analytics.tsx](src/pages/Analytics.tsx)
- 分析対象選択、ヒートマップ階層選択、PlanogramVisualizerで色付き表示

### [src/pages/InstructionSheet.tsx](src/pages/InstructionSheet.tsx)
- 店舗・棚割選択、印刷用レイアウト、注釈機能（3カテゴリ）、window.print() PDF出力
- 商品ツールチップ（JAN・フェイス数）対応

### [src/pages/BulkDelete.tsx](src/pages/BulkDelete.tsx)
- エンティティ種別選択→全データ削除（開発・メンテナンス用）

### [src/pages/masters/ProductMaster.tsx](src/pages/masters/ProductMaster.tsx)
- 商品CRUD（ページング・ソート・検索）、Excel/CSVインポート、一括編集、CSVエクスポート

### [src/pages/masters/ProductHierarchyMaster.tsx](src/pages/masters/ProductHierarchyMaster.tsx)
- 8レベル階層ツリー表示、追加・編集・削除、CSVインポート

### [src/pages/masters/FixtureMaster.tsx](src/pages/masters/FixtureMaster.tsx)
- 什器CRUD。タイプ: multi-tier, flat-refrigerated, flat-frozen, end-cap-refrigerated, end-cap-frozen, gondola

### [src/pages/masters/StoreMaster.tsx](src/pages/masters/StoreMaster.tsx)
- 店舗CRUD、サンプルデータ生成（generateSeedStores）

### [src/pages/masters/StoreFixtureMaster.tsx](src/pages/masters/StoreFixtureMaster.tsx)
- 店舗選択→什器配置一覧、StoreLayoutEditorでフロアレイアウト編集

### [src/pages/blocks/ShelfBlockEditor.tsx](src/pages/blocks/ShelfBlockEditor.tsx)
- ブロック作成・編集、D&Dで商品配置、SCALE=0.3ビジュアルプレビュー
- カテゴリ色分け、商品ツールチップ（JAN・フェイス数）対応

### [src/pages/planogram/StandardPlanogramEditor.tsx](src/pages/planogram/StandardPlanogramEditor.tsx)
- FMT別棚割一覧、ブロックD&D配置、什器タイプ別タブ、適用期間設定、複製機能
- 分析モード（ヒートマップ）、カテゴリ色分け、商品ツールチップ対応

### [src/pages/planogram/StorePlanogramBatch.tsx](src/pages/planogram/StorePlanogramBatch.tsx)
- FMTカード選択→標準棚割選択→店舗チェックボックス→一括生成→結果レポート

### [src/pages/planogram/StorePlanogramEditor.tsx](src/pages/planogram/StorePlanogramEditor.tsx)
- 自動生成棚割の確認・手動調整、フェイス数±（オーバーフローチェック付き）
- 商品D&D追加、同期ボタン、カテゴリ色分け、商品ツールチップ対応

---

## 15. ルーティング一覧

| パス | コンポーネント | 機能 |
|------|----------------|------|
| `/` | `HomePage` | ホーム・統計・初期化 |
| `/dashboard` | `Dashboard` | KPI分析ダッシュボード |
| `/analytics` | `Analytics` | 詳細分析（ヒートマップ） |
| `/masters/products` | `ProductMaster` | 商品マスタCRUD |
| `/masters/hierarchy` | `ProductHierarchyMaster` | 商品階層管理 |
| `/masters/fixtures` | `FixtureMaster` | 棚什器管理 |
| `/masters/stores` | `StoreMaster` | 店舗管理 |
| `/masters/store-fixtures` | `StoreFixtureMaster` | 店舗棚尺配置 |
| `/blocks` | `ShelfBlockEditor` | 棚ブロック作成 |
| `/planogram/standard` | `StandardPlanogramEditor` | FMT標準棚割 |
| `/planogram/store` | `StorePlanogramBatch` | 個店棚割一括生成 |
| `/planogram/store/:storeId` | `StorePlanogramEditor` | 個店棚割編集 |
| `/instruction-sheet` | `InstructionSheet` | 指示書生成 |
| `/bulk-delete` | `BulkDelete` | データ一括削除 |

---

## 16. 主要ドメイン型定義

### 定数

```typescript
export const REGIONS = ['北海道', '東北', '関東', '中部', '近畿', '中国・四国', '九州', '全地域'] as const;
export const FMTS = ['MEGA', 'SuC', 'SMART', 'GO', 'FC'] as const;
export const FIXTURE_TYPES = ['multi-tier', 'flat-refrigerated', 'flat-frozen', 'end-cap-refrigerated', 'end-cap-frozen', 'gondola'] as const;
export const ZONE_TYPES = ['多段', '平台冷蔵', '平台冷蔵エンド', '平台冷凍', '平台冷凍エンド'] as const;
export const SHAKU_TO_MM = 300;
```

### Product（商品）
```typescript
{
  id: string
  jan: string                    // JANコード（空文字許容）
  name: string                   // 商品名
  width: number                  // 幅（mm）
  height: number                 // 高さ（mm）
  depth: number                  // 奥行き（mm）
  category: string               // カテゴリ
  imageUrl: string               // 画像URL
  salesRank: number              // 売上ランク（1=最高, 100=最低）
  salesQuantity?: number         // 売上数量（ランク計算用）
  // 分析メトリクス
  quantity?: number              // 売上数量
  sales?: number                 // 売上金額
  grossProfit?: number           // 粗利
  traffic?: number               // 客数
  spendPerCustomer?: number      // 客単価
  // 組織階層（8レベル、各コード・名称の16フィールド）
  divisionCode?: string          // 事業部CD
  divisionName?: string          // 事業部
  divisionSubCode?: string       // ディビジョンCD
  divisionSubName?: string       // ディビジョン名
  lineCode?: string              // ラインCD
  lineName?: string              // ライン名
  departmentCode?: string        // 部門CD
  departmentName?: string        // 部門名
  categoryCode?: string          // カテゴリCD
  categoryName?: string          // カテゴリ名
  subCategoryCode?: string       // サブカテゴリCD
  subCategoryName?: string       // サブカテゴリ名
  segmentCode?: string           // セグメントCD
  segmentName?: string           // セグメント名
  subSegmentCode?: string        // サブセグメントCD
  subSegmentName?: string        // サブセグメント名
}
```

### Store（店舗）
```typescript
{
  id: string
  code: string                   // 店舗コード
  name: string                   // 店舗名
  fmt: FMT                       // FMT（MEGA/SuC/SMART/GO/FC）
  region: Region                 // 地域
}
```

### Fixture（棚什器）
```typescript
{
  id: string
  name: string
  width: number                  // mm
  height: number                 // mm
  depth?: number                 // mm（平台の奥行き）
  shelfCount: number             // 棚段数
  fixtureType?: FixtureType      // 什器タイプ
  manufacturer?: string
  modelNumber?: string
  installDate?: string
  warrantyEndDate?: string
}
```

### StoreFixturePlacement（店舗内什器配置）
```typescript
{
  id: string
  storeId: string
  fixtureId: string
  positionX: number              // フロアレイアウト上のX座標（mm）
  positionY: number              // フロアレイアウト上のY座標（mm）
  order: number                  // 表示順
  direction?: number             // 向き（0, 90, 180, 270度）
  zone?: ZoneType                // ゾーン名
  label?: string                 // ラベル
}
```

### ShelfBlock（棚ブロック）
```typescript
{
  id: string
  name: string
  description?: string
  blockType?: 'multi-tier' | 'flat'
  width: number                  // mm
  height: number                 // mm
  shelfCount: number
  productPlacements: ProductPlacement[]
  createdAt: string
  updatedAt: string
}

interface ProductPlacement {
  id: string
  productId: string
  shelfIndex: number             // 棚段（0始まり）
  positionX: number              // 段内の位置（mm）
  faceCount: number              // フェイス数
}
```

### StandardPlanogram（FMT標準棚割）
```typescript
{
  id: string
  fmt: FMT
  name: string
  baseStoreId: string
  fixtureType?: FixtureType
  width: number                  // mm
  height: number                 // mm
  shelfCount: number
  startDate?: string             // 適用開始日
  endDate?: string               // 適用終了日
  description?: string           // メモ・用途
  blocks: StandardPlanogramBlock[]
  products: StandardPlanogramProduct[]
  createdAt: string
  updatedAt: string
}
```

### StorePlanogram（個店棚割）
```typescript
{
  id: string
  storeId: string
  standardPlanogramId: string
  width: number                  // 店舗実棚幅（mm）
  height: number
  shelfCount: number
  products: StorePlanogramProduct[]
  status: PlanogramStatus        // 'pending' | 'generated' | 'warning' | 'error' | 'synced'
  warnings: string[]
  createdAt: string
  updatedAt: string
  syncedAt?: string
}

interface StorePlanogramProduct {
  id: string
  productId: string
  shelfIndex: number
  positionX: number
  faceCount: number
  isAutoGenerated: boolean
  isCut: boolean
}
```

---

## 17. データフロー・操作フロー

### 初回セットアップ
```
ホーム画面
  └─ 店舗マスタ生成（seedData.ts）
      └─ 18店舗を localStorage または Supabase に保存
```

### マスタ設定フロー
```
商品マスタ登録（ProductMaster）
  └─ Excel/CSVインポート または 手動入力
  └─ salesRank 自動計算（excelUtils.calculateSalesRank）

什器マスタ登録（FixtureMaster）
  └─ 什器サイズ(mm)・タイプを登録

店舗棚尺設定（StoreFixtureMaster）
  └─ 店舗に什器を配置 → StoreFixturePlacement 作成
```

### 棚割作成フロー
```
棚ブロック作成（ShelfBlockEditor）
  └─ 商品を棚段にD&D配置・フェイス数設定

FMT標準棚割作成（StandardPlanogramEditor）
  └─ 棚ブロックを配置（什器タイプ別タブ）

個店棚割一括生成（StorePlanogramBatch）
  └─ automationService.batchGenerateStorePlanograms()
      ├─ 店舗棚幅 < 標準 → ルールA（カット）
      └─ 店舗棚幅 > 標準 → ルールB（拡張）

個店棚割調整（StorePlanogramEditor）
  └─ 手動でフェイス数±・商品追加削除（オーバーフローチェック付き）
  └─ 同期（ルールC）で標準棚割の最新を再適用
```

### 分析フロー
```
ダッシュボード（Dashboard）
  └─ aggregationUtils で KPI 集計・グラフ表示

詳細分析（Analytics）
  └─ heatmapUtils で棚割ヒートマップ色計算
  └─ PlanogramVisualizer で棚割を色付き表示（jan/hierarchy/block/planogramの4レベル）
```

### 指示書生成フロー
```
指示書（InstructionSheet）
  └─ 店舗・棚割を選択
  └─ 注釈・コメント追加（変更点/注意事項/補足の3カテゴリ）
  └─ 印刷用レイアウトで棚割ビジュアル + 商品リスト表示
  └─ window.print() で印刷/PDF出力
```
