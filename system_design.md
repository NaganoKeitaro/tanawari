# システムアーキテクチャ設計書 (System Architecture Design)

**作成日**: 2026-01-08
**最終更新日**: 2026-03-13
**プロジェクト**: 棚割管理システム (Planogram System)

## 1. はじめに

本書は、棚割管理システムの技術的なアーキテクチャ、技術スタック、およびシステム構成を定義するものである。
機能的な要件および詳細仕様については、[基本設計書](./basic_design.md)および[詳細設計書](./detailed_design.md)を参照すること。

## 2. システム概要

### 2.1 目的
*   標準棚割作成工数の削減
*   個店展開業務の自動化
*   棚割調整業務の属人化解消

### 2.2 アーキテクチャ構成
UI層とデータ層を疎結合にするレイヤードアーキテクチャを採用する。

*   **Presentation Layer (UI)**: Reactコンポーネント。ユーザー操作を受け付け、Service層を呼び出す。
*   **Domain/Service Layer**: ビジネスロジック（棚割計算、バリデーション、自動生成）。
*   **Data Access Layer (Repository)**: データの永続化を担当。環境変数に応じてSupabase（本番）またはLocalStorage（開発）を自動選択。

### 2.3 技術スタック

| 区分 | 技術 | バージョン | 備考 |
|------|------|-----------|------|
| フロントエンド | React | 19.2.0 | |
| 言語 | TypeScript | 5.x | strict: true |
| ビルドツール | Vite | 6.x | tsc -b && vite build |
| ルーティング | React Router DOM | 7.11.0 | BrowserRouter + 14ルート |
| D&D | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 | 商品・ブロック配置 |
| バックエンド | Supabase (PostgreSQL) | 2.97.0 | 本番用 |
| フォールバック | LocalStorage | - | 開発・オフライン用 |
| Excel処理 | xlsx | 0.18.5 | Excel/CSVインポート・エクスポート |
| スタイリング | インラインスタイル | - | CSS-in-JS方式 |
| デプロイ | Vercel | - | SPA対応リライト設定 |

### 2.4 アーキテクチャ図

![System Architecture](./docs/images/architecture_diagram.png)

### 2.5 データフロー図

![Data Flow](./docs/images/data_flow.png)

## 3. データ設計方針

データ永続化層の設計方針。具体的なテーブル定義は[データベース論理設計書](./database_logical_design.md)を参照。

### 3.1 リポジトリパターン
`src/data/repositories/baseRepository.ts` の `IRepository<T>` インターフェースを定義し、2つの具象クラスで実装する。

```typescript
interface IRepository<T> {
    getAll(): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    create(item: Omit<T, 'id'>): Promise<T>;
    update(id: string, item: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    query(predicate: (item: T) => boolean): Promise<T[]>;
}
```

*   **`LocalStorageRepository<T>`**: 開発・オフライン用。`crypto.randomUUID()` でID自動生成。
*   **`SupabaseRepository<T>`**: 本番用。camelCase ↔ snake_case の自動変換機能付き。
*   **`repositoryFactory.ts`**: `VITE_SUPABASE_URL` 環境変数の有無で実装を自動選択。

### 3.2 エンティティ概要
*   **Product**: 商品基本情報 + 分析メトリクス（売上・粗利・客数・客単価）+ 組織階層（8レベル16フィールド）。JANなし（インハウス等）も許容。
*   **Store**: 店舗情報（コード、名称、FMT、地域）
*   **Fixture**: 什器マスタ（`fixtureType` で機能別分類: multi-tier/flat-refrigerated/flat-frozen/end-cap-refrigerated/end-cap-frozen/gondola）
*   **StoreFixturePlacement**: 店舗ごとの什器の平面レイアウト（絶対座標 X, Y mm、回転角度 0/90/180/270）を保持。
*   **ShelfBlock**: 商品群（フェイス等）の組み合わせテンプレート。blockType（multi-tier/flat）を持つ。
*   **StandardPlanogram**: 標準・デフォルトとなる陳列計画。適用期間（startDate/endDate）を持つ。
*   **StorePlanogram**: 個店舗ごとの拡張・カットを経て生成される陳列実態データ。status（pending/generated/warning/error/synced）で管理。

### 3.3 データフロー・設計の分離性
* 什器の物理的な「レイアウト（2D）」と、その中に置かれる「棚割（段と一次元横座標）」は内部で疎結合に実装されている。
* エディタ内でのドラッグ（DND）に伴う座標の変位や判定では、この疎結合な設計をUI上で計算合成することでリアルタイムに反映。
* 単位はシステム全体で `mm` に統一（`SHAKU_TO_MM = 300`、1尺 = 300mm）。

### 3.4 Supabaseスキーマ
PostgreSQLデータベースのスキーマは以下の3ファイルで管理:
*   `supabase/schema.sql`: メインテーブル定義（12テーブル）
*   `supabase/schema_hierarchy.sql`: 商品階層テーブル追加定義
*   `supabase/migrations/20260227_cm_to_mm.sql`: cm→mm単位変換マイグレーション
*   `supabase/migrations/20260309_add_missing_columns.sql`: store_planograms/standard_planogramsカラム追加
*   `supabase/migrations/20260311_fix_shelf_block_decimal_precision.sql`: shelf_block decimal精度修正

## 4. 今後の拡張性

1.  **認証機能**: Firebase Auth等の導入を想定し、ユーザーコンテキストを渡しやすいContext設計とする。
2.  **API連携**: 外部システム（基幹システム）からのデータインポートインターフェースの分離。
3.  **RLS（Row Level Security）**: Supabase RLSによるマルチテナント対応。

---
以上
