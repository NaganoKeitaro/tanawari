# システムアーキテクチャ設計書 (System Architecture Design)

**作成日**: 2026-01-08 (更新: 2026-01-09)
**プロジェクト**: 棚割管理システム (Planogram System) MVP

## 1. はじめに

本書は、棚割管理システムMVPの技術的なアーキテクチャ、技術スタック、およびシステム構成を定義するものである。
機能的な要件および詳細仕様については、[基本設計書](./basic_design.md)および[詳細設計書](./detailed_design.md)を参照すること。

## 2. システム概要

### 2.1 目的
*   標準棚割作成工数の削減
*   個店展開業務の自動化
*   棚割調整業務の属人化解消

### 2.2 アーキテクチャ構成
将来的なクラウド移行（GCP/Firestore）を見据え、UI層とデータ層を疎結合にするレイヤードアーキテクチャを採用する。

*   **Presentation Layer (UI)**: Reactコンポーネント。ユーザー操作を受け付け、Service層を呼び出す。
*   **Domain/Service Layer**: ビジネスロジック（棚割計算、バリデーション）。
*   **Data Access Layer (Repository)**: データの永続化を担当。現在はLocalStorageを使用するが、将来的にFirestoreへ差し替え可能な設計とする。

### 2.3 技術スタック
*   **フロントエンド**: React (v18), TypeScript
*   **ビルドツール**: Vite
*   **状態管理/データ永続化**: Custom Hooks + Repository Pattern (LocalStorage)
*   **UI/スタイリング**: Vanilla CSS + CSS Variables
*   **ドラッグ＆ドロップ**: @dnd-kit/core

### 2.4 アーキテクチャ図

![System Architecture](./docs/images/architecture_diagram.png)

## 3. データ設計方針

データ永続化層の設計方針。具体的なテーブル定義は[データベース論理設計書](./database_logical_design.md)を参照。

### 3.1 リポジトリパターン
`src/data/repositories/baseRepository.ts` の `IRepository` インターフェースを定義し、具象クラス（`LocalStorageRepository`）で実装する。
これにより、アプリケーションロジックを変更することなく、将来的なバックエンドDB移行（例: `FirestoreRepository`）を容易にする。

### 3.2 エンティティ概要
*   **Product**: 商品情報
*   **Store**: 店舗情報
*   **Fixture**: 什器マスタ
*   **StoreFixturePlacement**: 店舗ごとの什器配置（棚枠）
*   **ShelfBlock**: 商品構成テンプレート
*   **StandardPlanogram**: 標準棚割
*   **StorePlanogram**: 個店棚割

## 4. 今後の拡張性

本MVPはクライアントサイド（LocalStorage）で完結しているが、以下の拡張性を考慮して実装されている。

1.  **データベース移行**: Repositoryパターンの採用により、データソースの差し替えが容易。
2.  **認証機能**: Firebase Auth等の導入を想定し、ユーザーコンテキストを渡しやすいContext設計とする。
3.  **API連携**: 外部システム（基幹システム）からのデータインポートインターフェースの分離。

---
以上
