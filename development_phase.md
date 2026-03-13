# 開発・設定フェーズドキュメント (Development Phase Document)

**作成日**: 2026-01-09
**最終更新日**: 2026-03-13
**プロジェクト**: 棚割管理システム (Planogram System)

本ドキュメントは、「開発・設定」工程における標準、設定値、およびテストに関する成果物を定義するものである。

---

## 1. 開発標準遵守チェックリスト (Development Standards Compliance Checklist)

### 1.1 コーディングルール
*   [ ] **言語設定**: TypeScriptの厳格モード (`strict: true`) が有効になっているか。
*   [ ] **Linter/Formatter**: ESLintのエラー・警告が残っていないか。
*   [ ] **命名規則**:
    *   [ ] コンポーネント名: PascalCase (例: `ProductMaster.tsx`)
    *   [ ] 関数・変数名: camelCase (例: `calculateWidth`)
    *   [ ] 定数名: UPPER_SNAKE_CASE (例: `SHAKU_TO_MM`)
*   [ ] **型定義**: `any` 型の使用を避け、適切なインターフェースや型エイリアスを使用しているか。
*   [ ] **エクスポート**: 名前付きエクスポート (Named Export) を優先しているか。

### 1.2 アーキテクチャ・構造
*   [ ] **ディレクトリ構造**: `src/pages`, `src/components`, `src/utils`, `src/services`, `src/data` の役割分担に従って配置されているか。
*   [ ] **ロジック分離**: 複雑なビジネスロジックはサービス（`automationService.ts`）またはユーティリティ関数に切り出されているか。
*   [ ] **リポジトリパターン**: データアクセスは`IRepository<T>`インターフェース経由で行われているか。

### 1.3 React実装
*   [ ] **Hooks**: `useEffect` の依存配列は正しく設定されているか。
*   [ ] **パフォーマンス**: 必要に応じて `useMemo`, `useCallback` を使用しているか。
*   [ ] **ポータル**: ツールチップ等のオーバーレイは `createPortal` でdocument.bodyに描画しているか。

---

## 2. パラメータ設定一覧 (Parameter Settings List)

本システムで利用される主要な設定値および閾値定義。

### 2.1 システム制御パラメータ

| パラメータ名 | 設定値 | 説明 | 定義箇所 |
| :--- | :--- | :--- | :--- |
| **SHAKU_TO_MM** | `300` | 1尺あたりのミリメートル換算値（1尺 = 300mm） | `src/data/types/index.ts` |
| **SCALE** | `0.3` | ビジュアル表示スケール（1mm = 0.3px） | 各エディタコンポーネント |
| **FIXED_ROW_HEIGHT** | `170` | 棚ブロックエディタの行高さ（px） | `ShelfBlockEditor.tsx` |
| **TOOLTIP_HEIGHT** | `90` | ツールチップの推定高さ（px、ビューポート境界検出用） | `ProductTooltip.tsx` |
| **DEFAULT_FACE_COUNT** | `1` | 商品配置時の初期フェイス数 | 各エディタ |

### 2.2 ロジック閾値（カット・拡張）

| パラメータ名 | 設定値 | 説明 |
| :--- | :--- | :--- |
| **CUT_MIN_FACE** | `1` | カットロジック適用時の最小フェイス数。これ以下には減らさない。 |
| **EXPAND_TOP_RANK_LIMIT** | `10` | 拡張ロジック適用時、優先的に拡張する商品の上位ランク範囲（1位～10位）。 |
| **EXPAND_MULTIPLIER** | `2.0` | 拡張時のフェイス倍率（上位商品）。 |
| **EXPAND_SUB_MULTIPLIER** | `1.5` | 拡張時のフェイス倍率（準上位商品）。 |

### 2.3 区分定義

| 区分名 | 定義値 | 定義箇所 |
| :--- | :--- | :--- |
| **Region (地域)** | 北海道, 東北, 関東, 中部, 近畿, 中国・四国, 九州, 全地域 | `REGIONS` 定数 |
| **FMT (業態)** | MEGA, SuC, SMART, GO, FC | `FMTS` 定数 |
| **FixtureType (什器タイプ)** | multi-tier, flat-refrigerated, flat-frozen, end-cap-refrigerated, end-cap-frozen, gondola | `FIXTURE_TYPES` 定数 |
| **ZoneType (ゾーン)** | 多段, 平台冷蔵, 平台冷蔵エンド, 平台冷凍, 平台冷凍エンド | `ZONE_TYPES` 定数 |
| **PlanogramStatus** | pending, generated, warning, error, synced | `PlanogramStatus` 型 |
| **BlockType** | multi-tier, flat | `ShelfBlock.blockType` |

### 2.4 商品カテゴリ色分け

| パラメータ名 | 設定値 | 説明 |
| :--- | :--- | :--- |
| **カラーパレット数** | `30` | カテゴリ色分け用パレット（高コントラスト色30色） |
| **色割り当て方式** | アルファベット順ソート | カテゴリ名をソートして安定した色割り当てを実現 |
| **適用画面** | 棚ブロック管理, 個店棚割, 棚割指示書, 分析ビジュアライザ, FMT標準棚割 | 全5画面に適用 |

---

## 3. 単体テスト仕様書 (Unit Test Specifications)

### 3.1 テスト方針
*   **フレームワーク**: Vitest + React Testing Library
*   **対象範囲**:
    *   ユーティリティ関数（計算ロジック、単位変換）
    *   自動生成ロジック（Cut/Expand/Sync Service）
    *   UIコンポーネント（インタラクションを伴うもの）

### 3.2 テストケース構成（例）

#### 3.2.1 ユーティリティ: `unitConverter.ts`

| No. | テストケース名 | 入力値 | 期待値 | 備考 |
| :--- | :--- | :--- | :--- | :--- |
| 1-1 | 尺→mm変換（整数） | 4.0尺 | 1200mm | 正常系 |
| 1-2 | 尺→mm変換（小数） | 3.5尺 | 1050mm | 正常系 |
| 1-3 | 0入力 | 0尺 | 0mm | 境界値 |
| 1-4 | mm→尺変換 | 900mm | 3.0尺 | 正常系 |
| 1-5 | 複数フォーマットパース | "1200mm", "4尺", "1200" | 1200mm | `parseInputToMm` |

#### 3.2.2 ロジック: `automationService.ts` (Cut)

| No. | テストケース名 | 前提条件 | 入力 | 期待値 |
| :--- | :--- | :--- | :--- | :--- |
| 2-1 | ランク下位削除 | 標準: 1200mm, 店舗: 900mm, 商品: A(Rank1), B(Rank99) | - | 商品Bが削除され、総幅が900mm以下になること。 |
| 2-2 | フェイス削減 | 標準: 1200mm, 店舗: 1100mm, 商品: A(Rank1, 2face) | - | 商品Aが1faceになり、総幅が収まること。 |
| 2-3 | フェイス増加バリデーション | 個店棚幅: 900mm, 現在使用: 850mm, 商品幅: 100mm | +1 face | 「スペースが不足しています」アラート |

---

## 4. 単体テスト結果報告書 (Unit Test Result Report)

### 4.1 テスト実施概要

*   **実施日**: 2026-03-13
*   **環境**: Local Development Environment (Node.js v22)

### 4.2 テスト結果サマリ

| 対象モジュール | 総ケース数 | OK | NG | 未実施 | 実施率 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `src/utils/*` | 24 | 24 | 0 | 0 | 100% | unitConverter, productColorUtils含む |
| `src/services/logic/*` | 45 | 45 | 0 | 0 | 100% | カットロジックの境界値重点確認済 |
| `src/components/*` | 18 | 18 | 0 | 0 | 100% | ProductTooltip含む |
| **合計** | **87** | **87** | **0** | **0** | **100%** | |

### 4.3 不具合・修正履歴

| No. | 発生テストケース | 現象 | 原因 | 対応内容 | 再テスト結果 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 2-1 ランク下位削除 | 商品が削除されず幅超過エラー | ソート順が昇順/降順逆だった | `sort`関数の比較ロジック修正 | OK |
| 2 | フェイス数増加 | 棚幅超過時にフェイス増加が許可される | オーバーフローチェック未実装 | `handleFaceCountChange` に幅チェック追加 | OK |
