# Business Function List

## 1. Overview
- description: 棚割管理システムの業務機能一覧。マスタ管理・棚ブロック管理・標準棚割管理・個店棚割管理・売場レイアウト管理・分析・帳票出力・データ入出力の各領域にわたる業務機能を定義する。

## 2. Function List
| function_id | function_name | capability_id | description | actor | trigger |
|-------------|--------------|--------------|-------------|-------|---------|
| BF-001 | 商品マスタ管理 | CAP-001 | 商品の登録・更新・削除を行う | 棚割担当者 | マスタメニュー選択 |
| BF-002 | 店舗マスタ管理 | CAP-001 | 店舗の登録・更新・削除を行う | 棚割担当者 | マスタメニュー選択 |
| BF-003 | 什器マスタ管理 | CAP-001 | 什器の登録・更新・削除を行う | 棚割担当者 | マスタメニュー選択 |
| BF-004 | 商品階層マスタ管理 | CAP-001 | 商品分類階層の登録・更新・削除を行う | 棚割担当者 | マスタメニュー選択 |
| BF-005 | シードデータ生成 | CAP-001 | テスト用のサンプルデータを一括生成する | 開発者 | ホーム画面ボタン押下 |
| BF-006 | 棚ブロック編集 | CAP-002 | 棚ブロックの作成・商品配置・編集・削除を行う | 棚割担当者 | ブロックメニュー選択 |
| BF-007 | 標準棚割設計 | CAP-003 | FMT単位の標準棚割をブロック配置で設計する | 棚割担当者 | 標準棚割メニュー選択 |
| BF-008 | 標準棚割複製 | CAP-003 | 既存の標準棚割を複製して新規作成する | 棚割担当者 | 複製ボタン押下 |
| BF-009 | 個店棚割一括生成 | CAP-004 | 標準棚割から対象店舗の棚割を一括自動生成する | 棚割担当者 | 一括生成実行 |
| BF-010 | 個店棚割手動調整 | CAP-004 | 自動生成された棚割を手動で調整する | 棚割担当者 | 個店棚割エディタ操作 |
| BF-011 | 個店棚割同期 | CAP-004 | 標準棚割の最新状態を個店棚割に反映する | 棚割担当者 | 同期ボタン押下 |
| BF-012 | 個店棚割ステータス管理 | CAP-004 | 生成結果のステータス・警告を管理する | 棚割担当者 | 自動（生成時） |
| BF-013 | 店舗什器配置管理 | CAP-005 | 店舗フロアに什器をドラッグ&ドロップで配置する | 棚割担当者 | 店舗什器配置メニュー選択 |
| BF-014 | KPIダッシュボード表示 | CAP-006 | 売上・粗利・客数・客単価のKPIを表示する | 棚割担当者/マネージャ | ダッシュボードメニュー選択 |
| BF-015 | ヒートマップ分析 | CAP-006 | 棚割パフォーマンスをヒートマップで可視化する | 棚割担当者/マネージャ | 分析メニュー選択 |
| BF-016 | 棚割指示書出力 | CAP-007 | 店舗向け棚割指示書を生成・印刷する | 棚割担当者 | 指示書メニュー選択 |
| BF-017 | 商品データインポート | CAP-008 | Excel/CSVから商品データを一括取込する | 棚割担当者 | インポートボタン押下 |
| BF-018 | 商品データエクスポート | CAP-008 | 商品データをCSV出力する | 棚割担当者 | エクスポートボタン押下 |

## 3. Function Detail

### BF-001
- name: 商品マスタ管理
- description: 商品の新規登録、既存商品の更新、削除を行う。JAN（任意）、商品名、寸法（幅・高さ・奥行き mm）、カテゴリ、売上ランク（1-100）、画像URL、8階層の組織分類、分析指標（売上・粗利・客数・客単価）を管理する
- pre_condition: なし
- post_condition: 商品データが永続化される
- main_flow_ref: business_flow.md#FL-001

### BF-002
- name: 店舗マスタ管理
- description: 店舗の新規登録、更新、削除を行う。店舗コード（FMTプレフィックス＋4桁番号で自動採番）、店舗名、FMT（MEGA/SuC/SMART/GO/FC）、地域を管理する
- pre_condition: なし
- post_condition: 店舗データが永続化される
- main_flow_ref: business_flow.md#FL-002

### BF-003
- name: 什器マスタ管理
- description: 什器の新規登録、更新、削除を行う。什器名、寸法（幅・高さ・奥行き mm）、段数、什器タイプ（多段/平台冷蔵/平台冷凍/エンド冷蔵/エンド冷凍/ゴンドラ）、メーカー、型番、設置日、保証期限を管理する
- pre_condition: なし
- post_condition: 什器データが永続化される
- main_flow_ref: business_flow.md#FL-003

### BF-004
- name: 商品階層マスタ管理
- description: 8階層（事業部→ディビジョン→ライン→部門→カテゴリ→サブカテゴリ→セグメント→サブセグメント）の商品分類体系をツリービューで管理する。CSV一括インポートにも対応する
- pre_condition: なし
- post_condition: 階層データが永続化される
- main_flow_ref: business_flow.md#FL-004

### BF-005
- name: シードデータ生成
- description: 開発・テスト用にサンプルデータ（九州地域18店舗等）を一括生成する
- pre_condition: なし
- post_condition: サンプルデータが登録される
- main_flow_ref: business_flow.md#FL-005

### BF-006
- name: 棚ブロック編集
- description: 棚割の構成部品となるブロック（多段/平台）を作成し、ブロック内の各段に商品をドラッグ&ドロップで配置する。フェイス数の設定、カテゴリ色分け表示、0.3xスケールのプレビューを提供する
- pre_condition: 商品マスタにデータが存在する
- post_condition: 棚ブロックデータが永続化される
- main_flow_ref: business_flow.md#FL-006

### BF-007
- name: 標準棚割設計
- description: FMT・基準店舗・什器タイプを指定し、ブロックパレットから棚割キャンバスにブロックをドラッグ&ドロップで配置する。ブロック内の商品が個別商品として展開される。適用期間・説明も設定可能
- pre_condition: 棚ブロックが作成済み、什器マスタにデータが存在する
- post_condition: 標準棚割データが永続化される
- main_flow_ref: business_flow.md#FL-007

### BF-008
- name: 標準棚割複製
- description: 既存の標準棚割を複製して新しい標準棚割を作成する。ブロック配置・商品配置がコピーされる
- pre_condition: 複製元の標準棚割が存在する
- post_condition: 新規標準棚割データが永続化される
- main_flow_ref: business_flow.md#FL-008

### BF-009
- name: 個店棚割一括生成
- description: 標準棚割を選択し、対象店舗を指定して一括生成を実行する。各店舗の什器幅と標準棚割幅を比較し、ルールA（カット）またはルールB（拡張）を自動適用する。進捗バーでリアルタイムに処理状況を表示する
- pre_condition: 標準棚割が作成済み、対象店舗の什器配置が設定済み
- post_condition: 個店棚割データが生成される（ステータス・警告付き）
- main_flow_ref: business_flow.md#FL-009

### BF-010
- name: 個店棚割手動調整
- description: 自動生成された個店棚割を手動で編集する。商品の追加（ドラッグ&ドロップ）、削除、フェイス数変更（±ボタン）、棚幅オーバーフロー検知を行う
- pre_condition: 個店棚割が生成済み
- post_condition: 調整内容が永続化される
- main_flow_ref: business_flow.md#FL-010

### BF-011
- name: 個店棚割同期
- description: 標準棚割の最新状態を個店棚割に再適用する。ルールA/Bを再度実行し、ステータスをsyncedに更新する
- pre_condition: 個店棚割が生成済み、標準棚割が更新済み
- post_condition: 個店棚割が最新の標準棚割で再生成される
- main_flow_ref: business_flow.md#FL-011

### BF-012
- name: 個店棚割ステータス管理
- description: 個店棚割の生成結果（pending/generated/warning/error/synced）と警告メッセージを管理する
- pre_condition: 個店棚割生成処理が実行される
- post_condition: ステータスが更新される
- main_flow_ref: business_flow.md#FL-012

### BF-013
- name: 店舗什器配置管理
- description: 店舗フロアの2Dグリッド上に什器をドラッグ&ドロップで配置する。回転（0/90/180/270度）、衝突検知（AABB方式）、ゾーン・ラベル付けに対応する
- pre_condition: 店舗マスタ・什器マスタにデータが存在する
- post_condition: 配置データが永続化される
- main_flow_ref: business_flow.md#FL-013

### BF-014
- name: KPIダッシュボード表示
- description: 全店または個店スコープで、売上・粗利・客数・客単価のKPIカードを表示する。カテゴリ別棒グラフ・構成比パイチャート（SVG）、利益率計算を行う
- pre_condition: 商品データに分析指標が設定済み
- post_condition: なし（表示のみ）
- main_flow_ref: business_flow.md#FL-014

### BF-015
- name: ヒートマップ分析
- description: 4レベル（JAN/階層/ブロック/棚割）×5指標（売上/粗利/数量/客数/客単価）のヒートマップを棚割ビジュアライザ上に表示する
- pre_condition: 棚割データ・分析指標データが存在する
- post_condition: なし（表示のみ）
- main_flow_ref: business_flow.md#FL-015

### BF-016
- name: 棚割指示書出力
- description: 店舗向けの棚割指示書を生成する。ヘッダ（タイトル・作成日・適用日・店舗情報）、注記（変更/注意/備考のカラーコード）、フロアレイアウト、什器別棚割、ブロック詳細表、商品一覧表を含むPDF印刷用ドキュメントを出力する
- pre_condition: 個店棚割が生成済み
- post_condition: なし（ブラウザ印刷）
- main_flow_ref: business_flow.md#FL-016

### BF-017
- name: 商品データインポート
- description: Excel（XLSX）/CSVファイルから商品データを一括取込する。カラムマッピング（16階層フィールド＋商品基本情報）、バリデーション、プレビュー、重複処理（スキップ/上書き）、売上ランク自動計算に対応する
- pre_condition: インポートファイルが準備済み
- post_condition: 商品データが登録される
- main_flow_ref: business_flow.md#FL-017

### BF-018
- name: 商品データエクスポート
- description: 商品データをCSV（UTF-8）形式で出力する。スキップされた商品のエクスポートにも対応する
- pre_condition: 商品マスタにデータが存在する
- post_condition: CSVファイルがダウンロードされる
- main_flow_ref: business_flow.md#FL-018
