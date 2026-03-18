# Use Case List

## 1. Use Case List
| usecase_id | usecase_name | actor | description |
|------------|-------------|-------|-------------|
| UC-001 | 商品を登録する | 棚割担当者 | 新規商品をマスタに登録する |
| UC-002 | 商品を更新する | 棚割担当者 | 既存商品の情報を変更する |
| UC-003 | 商品を削除する | 棚割担当者 | 商品をマスタから削除する |
| UC-004 | 商品を一括インポートする | 棚割担当者 | Excel/CSVから商品を一括取込する |
| UC-005 | 商品をエクスポートする | 棚割担当者 | 商品データをCSV出力する |
| UC-006 | 商品を一括編集する | 棚割担当者 | 複数商品の情報を一括変更する |
| UC-007 | 店舗を登録する | 棚割担当者 | 新規店舗をマスタに登録する |
| UC-008 | 什器を登録する | 棚割担当者 | 新規什器をマスタに登録する |
| UC-009 | 商品階層を管理する | 棚割担当者 | 8階層の商品分類を追加・編集・削除する |
| UC-010 | 商品階層をCSVインポートする | 棚割担当者 | CSVから商品階層を一括取込する |
| UC-011 | 棚ブロックを作成する | 棚割担当者 | 新規棚ブロックを作成する |
| UC-012 | ブロックに商品を配置する | 棚割担当者 | ブロック内の段に商品をD&Dで配置する |
| UC-013 | 標準棚割を設計する | 棚割担当者 | FMT基準の標準棚割をブロック配置で設計する |
| UC-014 | 標準棚割を複製する | 棚割担当者 | 既存の標準棚割を複製する |
| UC-015 | 個店棚割を一括生成する | 棚割担当者 | 標準棚割から複数店舗の棚割を一括自動生成する |
| UC-016 | 個店棚割を手動調整する | 棚割担当者 | 自動生成された棚割を手動で修正する |
| UC-017 | 個店棚割を同期する | 棚割担当者 | 標準棚割の変更を個店棚割に反映する |
| UC-018 | 店舗什器を配置する | 棚割担当者 | 店舗フロア上に什器をD&Dで配置する |
| UC-019 | KPIダッシュボードを閲覧する | 棚割担当者/マネージャ | 売上・粗利等のKPIを確認する |
| UC-020 | ヒートマップ分析を行う | 棚割担当者/マネージャ | 棚割パフォーマンスをヒートマップで分析する |
| UC-021 | 棚割指示書を出力する | 棚割担当者 | 店舗向け棚割指示書を生成・印刷する |
| UC-022 | シードデータを生成する | 開発者 | テスト用サンプルデータを一括生成する |
| UC-023 | データを一括削除する | 開発者 | エンティティ単位でデータを一括削除する |

## 2. Use Case Detail

### UC-001
- actor: 棚割担当者
- pre_condition: 商品マスタ画面にアクセスできる
- post_condition: 商品データが永続化される
- main_flow_ref: business_flow.md#FL-001
- related_api: POST /products

### UC-002
- actor: 棚割担当者
- pre_condition: 対象商品が存在する
- post_condition: 商品データが更新される
- main_flow_ref: business_flow.md#FL-001 (alternative_flow)
- related_api: PUT /products/:id

### UC-003
- actor: 棚割担当者
- pre_condition: 対象商品が存在する
- post_condition: 商品データが削除される
- main_flow_ref: business_flow.md#FL-001
- related_api: DELETE /products/:id

### UC-004
- actor: 棚割担当者
- pre_condition: インポート用Excel/CSVファイルが準備済み
- post_condition: 商品データが一括登録される
- main_flow_ref: business_flow.md#FL-017
- related_api: POST /products/import

### UC-005
- actor: 棚割担当者
- pre_condition: 商品データが存在する
- post_condition: CSVファイルがダウンロードされる
- main_flow_ref: business_flow.md#FL-018
- related_api: GET /products/export

### UC-006
- actor: 棚割担当者
- pre_condition: 対象商品が存在する
- post_condition: 複数商品の情報が一括更新される
- main_flow_ref: business_flow.md#FL-001
- related_api: PUT /products/bulk

### UC-007
- actor: 棚割担当者
- pre_condition: 店舗マスタ画面にアクセスできる
- post_condition: 店舗データが永続化される（コード自動採番）
- main_flow_ref: business_flow.md#FL-002
- related_api: POST /stores

### UC-008
- actor: 棚割担当者
- pre_condition: 什器マスタ画面にアクセスできる
- post_condition: 什器データが永続化される
- main_flow_ref: business_flow.md#FL-003
- related_api: POST /fixtures

### UC-009
- actor: 棚割担当者
- pre_condition: 商品階層マスタ画面にアクセスできる
- post_condition: 階層データが更新される
- main_flow_ref: business_flow.md#FL-004
- related_api: POST/PUT/DELETE /product-hierarchy

### UC-010
- actor: 棚割担当者
- pre_condition: CSVファイルが準備済み
- post_condition: 階層データが一括登録される
- main_flow_ref: business_flow.md#FL-004 (alternative_flow)
- related_api: POST /product-hierarchy/import

### UC-011
- actor: 棚割担当者
- pre_condition: なし
- post_condition: 棚ブロックが作成される
- main_flow_ref: business_flow.md#FL-006
- related_api: POST /shelf-blocks

### UC-012
- actor: 棚割担当者
- pre_condition: 棚ブロックが作成済み、商品が登録済み
- post_condition: ブロック内に商品が配置される
- main_flow_ref: business_flow.md#FL-006
- related_api: PUT /shelf-blocks/:id/products

### UC-013
- actor: 棚割担当者
- pre_condition: 棚ブロックが作成済み、什器が登録済み
- post_condition: 標準棚割が作成される
- main_flow_ref: business_flow.md#FL-007
- related_api: POST /standard-planograms

### UC-014
- actor: 棚割担当者
- pre_condition: 複製元の標準棚割が存在する
- post_condition: 新規標準棚割が作成される
- main_flow_ref: business_flow.md#FL-008
- related_api: POST /standard-planograms/:id/duplicate

### UC-015
- actor: 棚割担当者
- pre_condition: 標準棚割が作成済み、対象店舗の什器配置が設定済み
- post_condition: 個店棚割がルールA/Bを適用して一括生成される
- main_flow_ref: business_flow.md#FL-009
- related_api: POST /store-planograms/batch-generate

### UC-016
- actor: 棚割担当者
- pre_condition: 個店棚割が生成済み
- post_condition: 個店棚割の商品配置が更新される
- main_flow_ref: business_flow.md#FL-010
- related_api: PUT /store-planograms/:id/products

### UC-017
- actor: 棚割担当者
- pre_condition: 個店棚割が生成済み、標準棚割が更新済み
- post_condition: 個店棚割がsyncedステータスに更新される
- main_flow_ref: business_flow.md#FL-011
- related_api: POST /store-planograms/:id/sync

### UC-018
- actor: 棚割担当者
- pre_condition: 店舗と什器が登録済み
- post_condition: 什器配置データが永続化される
- main_flow_ref: business_flow.md#FL-013
- related_api: POST /store-fixture-placements

### UC-019
- actor: 棚割担当者/マネージャ
- pre_condition: 商品データに分析指標が設定済み
- post_condition: なし（参照のみ）
- main_flow_ref: business_flow.md#FL-014
- related_api: GET /analytics/dashboard

### UC-020
- actor: 棚割担当者/マネージャ
- pre_condition: 棚割データと分析指標データが存在する
- post_condition: なし（参照のみ）
- main_flow_ref: business_flow.md#FL-015
- related_api: GET /analytics/heatmap

### UC-021
- actor: 棚割担当者
- pre_condition: 個店棚割が生成済み
- post_condition: なし（ブラウザ印刷）
- main_flow_ref: business_flow.md#FL-016
- related_api: GET /instruction-sheet/:storeId

### UC-022
- actor: 開発者
- pre_condition: なし
- post_condition: サンプルデータが登録される
- main_flow_ref: business_flow.md#FL-005
- related_api: POST /seed-data

### UC-023
- actor: 開発者
- pre_condition: データが存在する
- post_condition: 指定エンティティのデータが全削除される
- main_flow_ref: -
- related_api: DELETE /bulk-delete/:entityType
