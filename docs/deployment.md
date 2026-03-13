# デプロイガイド (Deployment Guide)

**最終更新日**: 2026-03-13

本プロジェクトは [Vercel](https://vercel.com) でホスティングされます。

## 前提条件
- Vercelアカウント
- Gitリポジトリ（GitHub）にプッシュ済みのプロジェクト
- （任意）Supabaseプロジェクト

## プロジェクト構成

- **フレームワーク**: Vite (React SPA)
- **ビルドコマンド**: `npm run build`（内部: `tsc -b && vite build`）
- **出力ディレクトリ**: `dist`
- **SPAリライト設定**: `vercel.json`

```json
{
    "rewrites": [
        {
            "source": "/(.*)",
            "destination": "/index.html"
        }
    ]
}
```

## デプロイ手順

### 1. Vercelにプロジェクトをインポート
1. Vercel Dashboardにアクセス
2. **"Add New..."** → **"Project"** をクリック
3. GitHubリポジトリをインポート

### 2. プロジェクトを設定
- **Framework Preset**: `Vite`（自動検出）
- **Build Command**: `npm run build`（デフォルト）
- **Output Directory**: `dist`（デフォルト）
- **Install Command**: `npm install`（デフォルト）

### 3. 環境変数を設定

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `VITE_SUPABASE_URL` | SupabaseプロジェクトのURL | 任意 |
| `VITE_SUPABASE_ANON_KEY` | Supabaseの匿名キー | 任意 |

> **注意**: 環境変数が未設定の場合、アプリケーションはLocalStorageをフォールバックとして使用します。本番環境ではSupabase環境変数の設定を推奨します。

### 4. デプロイ
**"Deploy"** ボタンをクリック。

## ローカルビルド確認

```bash
# ビルド（TypeScriptチェック + Viteビルド）
npm run build

# ビルド結果のプレビュー
npm run preview
```

> **注意**: `npm run build` は `tsc -b && vite build` を実行します。`tsc -b` は `tsc --noEmit` より厳密な型チェックを行うため、ローカルでビルドが通ることを確認してからpushしてください。

## Supabaseセットアップ（任意）

Supabaseをバックエンドとして使用する場合:

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. SQLエディタで以下のスキーマを順に実行:
   - `supabase/schema.sql`（メインテーブル12個）
   - `supabase/schema_hierarchy.sql`（商品階層テーブル）
   - `supabase/migrations/20260227_cm_to_mm.sql`（単位変換）
   - `supabase/migrations/20260309_add_missing_columns.sql`（カラム追加）
   - `supabase/migrations/20260311_fix_shelf_block_decimal_precision.sql`（精度修正）
3. プロジェクトのURL・匿名キーをVercelの環境変数に設定

## ブランチ戦略

- `main`: 本番デプロイ用
- `develop`: 開発用（Vercelプレビューデプロイ）
