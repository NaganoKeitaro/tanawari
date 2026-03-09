# コードベース概要ドキュメント

> 作成日: 2026-03-09
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

小売業向けの**棚割（プランチング）業務支援システム**。
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
| D&D | @dnd-kit/core + sortable | 6.3.1 |
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
│   ├── schema.sql                      # メインスキーマ
│   ├── schema_hierarchy.sql            # 商品階層スキーマ
│   └── migrations/
│       └── 20260227_cm_to_mm.sql       # 単位変換マイグレーション
└── src/
    ├── main.tsx                        # エントリーポイント
    ├── App.tsx                         # ルーティング定義
    ├── index.css                       # グローバルスタイル
    ├── data/
    │   ├── supabaseClient.ts
    │   ├── seedData.ts
    │   ├── types/
    │   │   ├── index.ts
    │   │   └── productHierarchy.ts
    │   └── repositories/
    │       ├── baseRepository.ts
    │       ├── localStorageRepository.ts
    │       ├── supabaseRepository.ts
    │       └── repositoryFactory.ts
    ├── services/
    │   └── automationService.ts
    ├── utils/
    │   ├── aggregationUtils.ts
    │   ├── excelUtils.ts
    │   ├── heatmapUtils.ts
    │   ├── hierarchyUtils.ts
    │   ├── hierarchyHelpers.tsx
    │   ├── metricsGenerator.ts
    │   └── unitConverter.ts
    ├── components/
    │   ├── common/
    │   │   ├── Modal.tsx
    │   │   ├── UnitInput.tsx
    │   │   └── UnitDisplay.tsx
    │   ├── layout/
    │   │   ├── AppLayout.tsx
    │   │   ├── StoreLayoutEditor.tsx
    │   │   └── StoreLayoutVisualizer.tsx
    │   ├── dashboard/
    │   │   ├── KPICard.tsx
    │   │   └── MetricsChart.tsx
    │   ├── masters/
    │   │   ├── ExcelImportModal.tsx
    │   │   ├── BulkEditModal.tsx
    │   │   └── HierarchyImportModal.tsx
    │   └── planogram/
    │       └── PlanogramVisualizer.tsx
    └── pages/
        ├── HomePage.tsx
        ├── Dashboard.tsx
        ├── Analytics.tsx
        ├── InstructionSheet.tsx
        ├── BulkDelete.tsx
        ├── masters/
        │   ├── ProductMaster.tsx
        │   ├── ProductHierarchyMaster.tsx
        │   ├── FixtureMaster.tsx
        │   ├── StoreMaster.tsx
        │   └── StoreFixtureMaster.tsx
        ├── blocks/
        │   └── ShelfBlockEditor.tsx
        └── planogram/
            ├── StandardPlanogramEditor.tsx
            ├── StorePlanogramBatch.tsx
            └── StorePlanogramEditor.tsx
```

---

## 4. 設定ファイル

### [package.json](package.json)
- **役割**: 依存関係管理・スクリプト定義
- **主要スクリプト**: `dev`（開発サーバー）, `build`（本番ビルド）, `lint`, `preview`
- **主要依存**:
  - `react` / `react-dom` 19.2.0
  - `react-router-dom` 7.11.0
  - `@dnd-kit/core`, `@dnd-kit/sortable` — ドラッグ&ドロップ
  - `@supabase/supabase-js` — バックエンドクライアント
  - `xlsx` — Excel読み書き

### [vite.config.ts](vite.config.ts)
- **役割**: Viteビルド設定
- **内容**: `@vitejs/plugin-react` プラグイン適用のみ（シンプル構成）

### [tsconfig.app.json](tsconfig.app.json)
- **役割**: TypeScriptコンパイル設定
- **主要設定**: `target: ES2022`, `strict: true`, `jsx: react-jsx`

### [vercel.json](vercel.json)
- **役割**: Vercelデプロイ設定
- **内容**: 全パスを `index.html` にリライト（SPAルーティング対応）

### [supabase/schema.sql](supabase/schema.sql)
- **役割**: Supabase（PostgreSQL）のメインテーブル定義
- **テーブル**: products, stores, fixtures, store_fixture_placements, shelf_blocks, standard_planograms, store_planograms

### [supabase/schema_hierarchy.sql](supabase/schema_hierarchy.sql)
- **役割**: 商品階層テーブルの追加定義（product_hierarchiesテーブル）

### [supabase/migrations/20260227_cm_to_mm.sql](supabase/migrations/20260227_cm_to_mm.sql)
- **役割**: 単位をcmからmmへ変換するデータマイグレーション

---

## 5. エントリーポイント

### [src/main.tsx](src/main.tsx)
- **役割**: Reactアプリケーションの起動点
- **内容**: `ReactDOM.createRoot()` で `<App />` をマウント。`StrictMode` 有効。

### [src/App.tsx](src/App.tsx)
- **役割**: ルーティング定義と全ページの統合
- **内容**:
  - `BrowserRouter` + `Routes` で全14ルートを定義
  - 全ページを `<AppLayout>` でラップ（共通ナビゲーション）
  - ルート一覧は [15章](#15-ルーティング一覧) 参照

### [src/index.css](src/index.css)
- **役割**: グローバルスタイル
- **内容**: リセットCSS、ボディフォント設定、基本レイアウト

---

## 6. データ層（data/）

### [src/data/supabaseClient.ts](src/data/supabaseClient.ts)
- **役割**: Supabaseクライアントの初期化・エクスポート
- **内容**: 環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` から `createClient()` でクライアント生成

### [src/data/seedData.ts](src/data/seedData.ts)
- **役割**: デモ用初期データの生成ロジック
- **内容**:
  - `generateSeedStores()` — 18店舗のサンプルデータを返す
  - 九州地方（筑豊・福岡ゾーン）中心
  - FMTプレフィックス（MEGA, SuC, SMART, GO, FC）+ 4桁番号でコード自動生成

### [src/data/types/index.ts](src/data/types/index.ts)
- **役割**: アプリ全体のドメイン型定義（最重要ファイル）
- **定数**:
  - `REGIONS`: 地域マスタ（北海道, 東北, 関東, 中部, 近畿, 中国, 四国, 九州）
  - `FMTS`: 店舗フォーマット（MEGA, SuC, SMART, GO, FC）
  - `SHAKU_TO_MM = 300`: 1尺 = 300mm
- **主要型**: → [16章](#16-主要ドメイン型定義) 参照

### [src/data/types/productHierarchy.ts](src/data/types/productHierarchy.ts)
- **役割**: 商品階層構造の型定義
- **内容**:
  - `ProductHierarchy` 型（id, divisionCode/Name, departmentCode/Name, lineCode/Name, subLineCode/Name）
  - 最大8レベルの商品分類階層をサポート

### [src/data/repositories/baseRepository.ts](src/data/repositories/baseRepository.ts)
- **役割**: リポジトリパターンのインターフェース定義
- **内容**:
  ```typescript
  interface IRepository<T> {
    getAll(): Promise<T[]>
    getById(id: string): Promise<T | null>
    create(item: Omit<T, 'id'>): Promise<T>
    update(id: string, item: Partial<T>): Promise<T | null>
    delete(id: string): Promise<boolean>
    query(predicate: (item: T) => boolean): Promise<T[]>
  }
  interface IDataStore {
    products: IRepository<Product>
    stores: IRepository<Store>
    fixtures: IRepository<Fixture>
    // ... 全エンティティ分
  }
  ```

### [src/data/repositories/localStorageRepository.ts](src/data/repositories/localStorageRepository.ts)
- **役割**: `localStorage` を使ったリポジトリ実装（オフライン/開発用）
- **内容**:
  - `LocalStorageRepository<T>` クラスが `IRepository<T>` を実装
  - IDは `crypto.randomUUID()` で自動生成
  - `LocalStorageDataStore` が全エンティティのリポジトリをまとめて保持

### [src/data/repositories/supabaseRepository.ts](src/data/repositories/supabaseRepository.ts)
- **役割**: Supabase（PostgreSQL）を使ったリポジトリ実装（本番用）
- **内容**:
  - `SupabaseRepository<T>` クラスが `IRepository<T>` を実装
  - camelCase ↔ snake_case の自動変換
  - `SupabaseDataStore` が全エンティティのリポジトリをまとめて保持

### [src/data/repositories/repositoryFactory.ts](src/data/repositories/repositoryFactory.ts)
- **役割**: 環境に応じてリポジトリ実装を自動選択するファクトリー
- **内容**:
  - `VITE_SUPABASE_URL` が設定済み → `SupabaseDataStore`
  - 未設定 → `LocalStorageDataStore`（フォールバック）
  - `getDataStore()` 関数を単一エクスポートポイントとして提供

---

## 7. サービス層（services/）

### [src/services/automationService.ts](src/services/automationService.ts)
- **役割**: 棚割の自動生成・同期ロジック（ビジネスロジックの核心）
- **エクスポート関数**:
  - `generateStorePlanogram(storeId, standardPlanogram)` — 1店舗分の個店棚割を生成
  - `batchGenerateStorePlanograms(storeIds, standardPlanogram)` — 複数店舗を一括生成
  - `syncStorePlanogram(storePlanogram, updatedStandard)` — 個店棚割を最新の標準棚割に同期

- **自動調整ルール**:

  | ルール | 条件 | 処理内容 |
  |--------|------|----------|
  | ルールA（カット） | 店舗棚幅 < 標準棚幅 | 売上ランク低い順にフェイス削減（最小1）→ それでも収まらなければ商品をカット |
  | ルールB（拡張） | 店舗棚幅 > 標準棚幅 | 売上ランク上位10商品を優先拡張。1st pass: 2倍フェイス、2nd pass: 1.5倍フェイス |
  | ルールC（同期） | 親棚割更新時 | 子の個店棚割を再生成して最新状態に同期 |

---

## 8. ユーティリティ（utils/）

### [src/utils/aggregationUtils.ts](src/utils/aggregationUtils.ts)
- **役割**: 売上・分析データの集計関数群
- **主要関数**:
  - `aggregateMetrics(products)` — 商品リストから売上合計・粗利・客数等を集計
  - `aggregateByCategory(products)` — カテゴリ別に集計してMapを返す
  - `aggregateByHierarchy(products, level)` — 階層レベル（division/department/line等）別に集計
  - `aggregateBySalesRank(products)` — ランク別（トップ20・中位20-60・低位60-100）に集計
  - `calculateProfitMargin(sales, grossProfit)` — 粗利率（%）を計算

### [src/utils/unitConverter.ts](src/utils/unitConverter.ts)
- **役割**: mm ↔ 尺の単位変換ユーティリティ
- **主要関数**:
  - `mmToShaku(mm)` — ミリメートルを尺に変換（1尺=300mm）
  - `shakuToMm(shaku)` — 尺をミリメートルに変換
  - `parseInputToMm(input)` — "1200mm", "4尺", "1200" など複数フォーマットをパース

### [src/utils/excelUtils.ts](src/utils/excelUtils.ts)
- **役割**: Excel / CSV ファイルの入出力処理
- **主要関数**:
  - `readExcelFile(file)` — ファイルをパースして行データ配列を返す
  - `validateExcelData(rows, schema)` — 必須列・型の検証
  - `exportProductsToCSV(products)` — 商品データをCSVエクスポート
  - `calculateSalesRank(products)` — 売上金額から1-100のランクを自動計算して付与

### [src/utils/heatmapUtils.ts](src/utils/heatmapUtils.ts)
- **役割**: ヒートマップ表示用の色計算・集計
- **主要関数**:
  - `calculateHeatmapColor(value, max)` — 最大値に対する割合で5段階の色を返す（高:赤→低:青）
  - `formatMetricValue(value, type)` — 値をK（千）/M（百万）単位にフォーマット
  - `aggregateByHierarchy(products, key)` — 階層キー別にメトリクスを集計したMapを返す

### [src/utils/hierarchyUtils.ts](src/utils/hierarchyUtils.ts)
- **役割**: 商品階層テンプレートの生成・管理
- **主要関数**:
  - `generateHierarchyTemplates()` — 標準的な商品分類テンプレートを生成
  - `flattenHierarchy(hierarchy)` — 階層ツリーをフラット配列に変換
  - `buildHierarchyTree(items)` — フラット配列から階層ツリーを構築

### [src/utils/hierarchyHelpers.tsx](src/utils/hierarchyHelpers.tsx)
- **役割**: 商品階層の React 表示ヘルパー（TSX）
- **主要内容**:
  - 階層レベルに応じたインデント・アイコン表示ロジック
  - 階層パンくずリスト生成関数

### [src/utils/metricsGenerator.ts](src/utils/metricsGenerator.ts)
- **役割**: デモ・テスト用のランダムメトリクス生成
- **主要関数**:
  - `generateRandomMetrics(productId)` — ランダムな売上・粗利・客数・客単価を生成
  - `generateRandomSize()` — ランダムな商品サイズ（幅・高さ・奥行き）を生成
  - `calculateMetricsFromQuantity(quantity, price)` — 数量・単価から各メトリクスを計算

---

## 9. 共通コンポーネント（components/common/）

### [src/components/common/Modal.tsx](src/components/common/Modal.tsx)
- **役割**: 汎用モーダルダイアログ
- **Props**: `isOpen`, `onClose`, `title`, `size`（sm/md/lg/xl）, `children`
- **機能**: ESCキー対応、スクロール固定、フェード+スライドアニメーション

### [src/components/common/UnitInput.tsx](src/components/common/UnitInput.tsx)
- **役割**: mm / 尺 切り替え対応の数値入力コンポーネント
- **Props**: `value`（mm）, `onChange`（mm）, `min`, `max`, `label`
- **機能**: mm入力・尺入力を切り替えボタンで選択可能。内部ではmm統一で管理。

### [src/components/common/UnitDisplay.tsx](src/components/common/UnitDisplay.tsx)
- **役割**: mm と尺を同時表示するテキストコンポーネント
- **Props**: `valueMm`
- **表示例**: `1200mm (4.0尺)`

---

## 10. レイアウトコンポーネント（components/layout/）

### [src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx)
- **役割**: アプリ全体の共通レイアウト（サイドバーナビ + メインコンテンツエリア）
- **内容**:
  - 左サイドバーにナビゲーションメニュー（ホーム、マスタ管理、棚割管理、分析・指示書）
  - `<Outlet />` で各ページを描画
  - アクティブなルートをハイライト

### [src/components/layout/StoreLayoutEditor.tsx](src/components/layout/StoreLayoutEditor.tsx)
- **役割**: 店舗フロアレイアウト上での什器配置編集UI
- **機能**:
  - 2Dグリッド上に `StoreFixturePlacement` を配置・移動・削除
  - ドラッグ&ドロップで位置調整
  - 向き（direction）・ゾーン名・ラベルの編集

### [src/components/layout/StoreLayoutVisualizer.tsx](src/components/layout/StoreLayoutVisualizer.tsx)
- **役割**: 店舗フロアレイアウトの読み取り専用ビジュアル表示
- **機能**: 什器配置を2Dグリッドで描画（編集なし）

---

## 11. ダッシュボードコンポーネント（components/dashboard/）

### [src/components/dashboard/KPICard.tsx](src/components/dashboard/KPICard.tsx)
- **役割**: KPI指標を表示するカードコンポーネント
- **Props**: `title`, `value`, `unit`, `trend`（前期比）, `color`
- **表示**: 数値・ユニット・前期比トレンドアイコン（▲▼）

### [src/components/dashboard/MetricsChart.tsx](src/components/dashboard/MetricsChart.tsx)
- **役割**: 棒グラフ・円グラフの描画コンポーネント（SVGベース）
- **Props**: `data`, `type`（bar/pie）, `metric`
- **機能**: カテゴリ別・階層別の売上/粗利/客数/客単価を視覚化

---

## 12. マスタコンポーネント（components/masters/）

### [src/components/masters/ExcelImportModal.tsx](src/components/masters/ExcelImportModal.tsx)
- **役割**: Excelファイルから商品データをインポートするモーダル
- **機能**: ファイル選択 → プレビュー表示 → バリデーション → インポート実行

### [src/components/masters/BulkEditModal.tsx](src/components/masters/BulkEditModal.tsx)
- **役割**: 複数商品を一括編集するモーダル
- **機能**: 選択した商品の指定フィールドを一括更新（カテゴリ、ランク等）

### [src/components/masters/HierarchyImportModal.tsx](src/components/masters/HierarchyImportModal.tsx)
- **役割**: 商品階層データをCSVからインポートするモーダル
- **機能**: CSV読み込み → 階層データとして検証・インポート

---

## 13. 棚割コンポーネント（components/planogram/）

### [src/components/planogram/PlanogramVisualizer.tsx](src/components/planogram/PlanogramVisualizer.tsx)
- **役割**: 棚割のヒートマップビジュアライザー
- **Props**: `planogram`, `metric`（評価指標）, `viewLevel`（表示階層）
- **表示モード**:
  - `jan` — 商品単品ごとに色付け
  - `hierarchy` — 指定した階層レベルごとに色付け
  - `block` — 棚ブロックごとに色付け
  - `planogram` — 棚割全体で色付け
- **機能**: 商品セルを棚段・位置に応じてグリッド配置し、ヒートマップ色を適用

---

## 14. ページコンポーネント（pages/）

### [src/pages/HomePage.tsx](src/pages/HomePage.tsx)
- **役割**: ホームページ（初期化・統計・説明）
- **機能**:
  - システム統計（商品数・店舗数・棚割数等）のカード表示
  - 初回利用ガイド（店舗マスタ生成ボタン）
  - ワークフロー説明
  - 自動調整ルールA/B/Cの説明

### [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)
- **役割**: KPI分析ダッシュボード
- **機能**:
  - スコープ選択（全社 / 個店）
  - KPIカード（売上・粗利・客数・客単価）
  - 評価指標選択（売上/粗利/数量/客数）
  - カテゴリ別棒グラフ + 構成比円グラフ

### [src/pages/Analytics.tsx](src/pages/Analytics.tsx)
- **役割**: 詳細分析ページ（ヒートマップ）
- **機能**:
  - 分析対象選択（標準棚割 / 個店棚割 / 棚ブロック）
  - ヒートマップ階層選択（単品/カテゴリ/ブロック/全体）
  - 評価指標・集計キー選択
  - `PlanogramVisualizer` で棚割ヒートマップを表示

### [src/pages/InstructionSheet.tsx](src/pages/InstructionSheet.tsx)
- **役割**: 個店棚割指示書の生成・表示
- **機能**:
  - 店舗・棚割選択
  - 印刷用レイアウトでの棚割ビジュアル + 商品リスト生成
  - 印刷ボタン（window.print）

### [src/pages/BulkDelete.tsx](src/pages/BulkDelete.tsx)
- **役割**: データ一括削除ページ（開発・メンテナンス用）
- **機能**: エンティティ種別を選択して全データを削除

### [src/pages/masters/ProductMaster.tsx](src/pages/masters/ProductMaster.tsx)
- **役割**: 商品マスタのCRUD管理ページ
- **機能**:
  - 商品一覧テーブル（ページング・ソート・検索）
  - 商品追加・編集・削除
  - Excel/CSVインポート（`ExcelImportModal`）
  - 一括編集（`BulkEditModal`）
  - CSV エクスポート

### [src/pages/masters/ProductHierarchyMaster.tsx](src/pages/masters/ProductHierarchyMaster.tsx)
- **役割**: 商品階層マスタ（分類体系）の管理ページ
- **機能**:
  - 8レベル階層（division → department → line → subLine等）のツリー表示
  - 階層の追加・編集・削除
  - CSVインポート（`HierarchyImportModal`）

### [src/pages/masters/FixtureMaster.tsx](src/pages/masters/FixtureMaster.tsx)
- **役割**: 棚什器マスタの管理ページ
- **機能**:
  - 什器一覧（名称・サイズ・棚数・タイプ）
  - 什器の追加・編集・削除
  - 什器タイプ: multi-tier（多段棚）, flat-refrigerated（冷蔵平台）, flat-frozen（冷凍平台）等

### [src/pages/masters/StoreMaster.tsx](src/pages/masters/StoreMaster.tsx)
- **役割**: 店舗マスタの管理ページ
- **機能**:
  - 店舗一覧（コード・名称・FMT・地域）
  - 店舗の追加・編集・削除
  - サンプルデータ生成ボタン（`generateSeedStores`）

### [src/pages/masters/StoreFixtureMaster.tsx](src/pages/masters/StoreFixtureMaster.tsx)
- **役割**: 店舗ごとの什器配置（棚尺）マスタ管理ページ
- **機能**:
  - 店舗選択 → その店舗の什器配置一覧表示
  - 什器の追加配置・位置編集・削除
  - `StoreLayoutEditor` でフロアレイアウト上での配置編集

### [src/pages/blocks/ShelfBlockEditor.tsx](src/pages/blocks/ShelfBlockEditor.tsx)
- **役割**: 棚ブロック（Building Blocks）の作成・編集ページ
- **機能**:
  - ブロック一覧・新規作成
  - 商品をドラッグ&ドロップで棚段に配置（@dnd-kit）
  - フェイス数・位置のリアルタイム更新
  - 0.3倍スケールのビジュアルプレビュー

### [src/pages/planogram/StandardPlanogramEditor.tsx](src/pages/planogram/StandardPlanogramEditor.tsx)
- **役割**: FMT標準棚割エディタページ
- **機能**:
  - FMT別・棚割一覧
  - 棚ブロックを棚割にドラッグ&ドロップで配置
  - 棚割のサイズ・棚数・有効期間設定
  - ブロック配置の順序変更・削除

### [src/pages/planogram/StorePlanogramBatch.tsx](src/pages/planogram/StorePlanogramBatch.tsx)
- **役割**: 個店棚割一括生成ページ
- **機能**:
  - 標準棚割選択 → 対象FMTの全店舗を表示
  - 店舗を選択して「一括生成」（`batchGenerateStorePlanograms`）
  - 生成ステータス（pending/generated/warning/error/synced）の一覧表示
  - 警告がある店舗の確認・詳細表示

### [src/pages/planogram/StorePlanogramEditor.tsx](src/pages/planogram/StorePlanogramEditor.tsx)
- **役割**: 個店棚割の個別編集ページ
- **機能**:
  - 自動生成された棚割の確認・手動調整
  - 商品のフェイス数変更・並び替え・削除
  - 商品追加（商品マスタから選択）
  - 親標準棚割との差分表示
  - 同期ボタン（`syncStorePlanogram`）

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

### Product（商品）
```typescript
{
  id: string
  jan: string                    // JANコード
  name: string                   // 商品名
  width: number                  // 幅（mm）
  height: number                 // 高さ（mm）
  depth: number                  // 奥行き（mm）
  category: string               // カテゴリ
  imageUrl?: string
  salesRank: number              // 売上ランク（1=最高, 100=最低）
  // 売上分析データ
  quantity?: number
  sales?: number
  grossProfit?: number
  traffic?: number               // 客数
  spendPerCustomer?: number      // 客単価
  // 商品階層（8レベル）
  divisionCode?: string          // 部門コード
  divisionName?: string
  departmentCode?: string
  // ... line, subLine まで続く
}
```

### Store（店舗）
```typescript
{
  id: string
  code: string                   // 店舗コード
  name: string                   // 店舗名
  fmt: string                    // FMT（MEGA/SuC/SMART/GO/FC）
  region: string                 // 地域
}
```

### Fixture（棚什器）
```typescript
{
  id: string
  name: string
  width: number                  // mm
  height: number                 // mm
  depth: number                  // mm
  shelfCount: number             // 棚段数
  fixtureType: FixtureType       // 'multi-tier' | 'flat-refrigerated' | 'flat-frozen' | ...
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
  positionX: number              // フロアレイアウト上のX座標
  positionY: number              // フロアレイアウト上のY座標
  order: number                  // 表示順
  direction: 'horizontal' | 'vertical'
  zone?: string                  // ゾーン名（生鮮、冷凍 等）
  label?: string                 // ラベル
}
```

### ShelfBlock（棚ブロック）
```typescript
{
  id: string
  name: string
  blockType: 'multi-tier' | 'flat'
  width: number                  // mm
  height: number                 // mm
  shelfCount: number
  productPlacements: ProductPlacement[]
}

type ProductPlacement = {
  productId: string
  shelfIndex: number             // 棚段（0始まり）
  position: number               // 棚段内の位置（0始まり）
  facings: number                // フェイス数
}
```

### StandardPlanogram（FMT標準棚割）
```typescript
{
  id: string
  fmt: string                    // 対象FMT
  name: string
  baseStoreId?: string           // 基準店舗
  width: number                  // mm
  height: number                 // mm
  shelfCount: number
  fixtureType: FixtureType
  startDate: string
  endDate: string
  blocks: StandardPlanogramBlock[]
  products: StandardPlanogramProduct[]
}
```

### StorePlanogram（個店棚割）
```typescript
{
  id: string
  storeId: string
  standardPlanogramId: string    // 親の標準棚割
  width: number                  // 店舗実棚幅（mm）
  height: number
  shelfCount: number
  products: StorePlanogramProduct[]
  status: 'pending' | 'generated' | 'warning' | 'error' | 'synced'
  warnings: string[]             // 幅超過・商品カット等の警告メッセージ
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
  └─ 什器サイズ・タイプを登録

店舗棚尺設定（StoreFixtureMaster）
  └─ 店舗に什器を配置 → StoreFixturePlacement 作成
```

### 棚割作成フロー
```
棚ブロック作成（ShelfBlockEditor）
  └─ 商品を棚段に配置・フェイス数設定

FMT標準棚割作成（StandardPlanogramEditor）
  └─ 棚ブロックを配置

個店棚割一括生成（StorePlanogramBatch）
  └─ automationService.batchGenerateStorePlanograms()
      ├─ 店舗棚幅 < 標準 → ルールA（カット）
      └─ 店舗棚幅 > 標準 → ルールB（拡張）

個店棚割調整（StorePlanogramEditor）
  └─ 手動で商品フェイス数・順序を微調整
```

### 分析フロー
```
ダッシュボード（Dashboard）
  └─ aggregationUtils で KPI 集計・グラフ表示

詳細分析（Analytics）
  └─ heatmapUtils で棚割ヒートマップ色計算
  └─ PlanogramVisualizer で棚割を色付き表示
```

### 指示書生成フロー
```
指示書（InstructionSheet）
  └─ 店舗・棚割を選択
  └─ 印刷用レイアウトで棚割ビジュアル + 商品リストを表示
  └─ window.print() で印刷/PDF出力
```
