# Event Catalog

## Event List
| event_id | event_name | trigger | payload | description |
|----------|-----------|---------|---------|-------------|
| EVT-001 | ProductCreated | 商品登録完了 | Product | 商品が新規登録された |
| EVT-002 | ProductUpdated | 商品更新完了 | Product | 商品情報が更新された |
| EVT-003 | ProductDeleted | 商品削除完了 | {productId} | 商品が削除された |
| EVT-004 | ProductsImported | インポート完了 | {count, skipped} | 商品が一括インポートされた |
| EVT-005 | StoreCreated | 店舗登録完了 | Store | 店舗が新規登録された |
| EVT-006 | FixtureCreated | 什器登録完了 | Fixture | 什器が新規登録された |
| EVT-007 | ShelfBlockCreated | ブロック作成完了 | ShelfBlock | 棚ブロックが作成された |
| EVT-008 | ShelfBlockUpdated | ブロック更新完了 | ShelfBlock | 棚ブロックが更新された |
| EVT-009 | StandardPlanogramCreated | 標準棚割作成完了 | StandardPlanogram | 標準棚割が作成された |
| EVT-010 | StandardPlanogramUpdated | 標準棚割更新完了 | StandardPlanogram | 標準棚割が更新された |
| EVT-011 | StandardPlanogramDuplicated | 標準棚割複製完了 | StandardPlanogram | 標準棚割が複製された |
| EVT-012 | BatchGenerationStarted | 一括生成開始 | {standardPlanogramId, storeIds} | 個店棚割の一括生成が開始された |
| EVT-013 | BatchGenerationProgress | 生成進捗更新 | {current, total} | 一括生成の進捗が更新された |
| EVT-014 | BatchGenerationCompleted | 一括生成完了 | {results, summary} | 個店棚割の一括生成が完了した |
| EVT-015 | StorePlanogramGenerated | 個店棚割生成完了 | StorePlanogram | 個店棚割が1件生成された |
| EVT-016 | StorePlanogramSynced | 個店棚割同期完了 | StorePlanogram | 個店棚割が標準棚割と同期された |
| EVT-017 | StorePlanogramManuallyEdited | 個店棚割手動編集 | StorePlanogram | 個店棚割が手動で調整された |
| EVT-018 | ProductPlacedOnShelf | 商品棚配置 | {productId, shelfIndex, faceCount} | 商品が棚に配置された |
| EVT-019 | ProductRemovedFromShelf | 商品棚削除 | {productId, shelfIndex} | 商品が棚から削除された |
| EVT-020 | FaceCountChanged | フェイス数変更 | {productId, oldCount, newCount} | フェイス数が変更された |
| EVT-021 | ShelfWidthOverflow | 棚幅超過検知 | {shelfIndex, currentWidth, maxWidth} | 段内商品幅が棚幅を超過した |
| EVT-022 | FixturePlaced | 什器配置完了 | StoreFixturePlacement | 什器がフロアに配置された |
| EVT-023 | FixtureCollisionDetected | 什器衝突検知 | {fixture1Id, fixture2Id} | 什器同士の衝突が検知された |
| EVT-024 | SeedDataGenerated | シードデータ生成完了 | {counts} | テスト用シードデータが生成された |
| EVT-025 | InstructionSheetGenerated | 指示書生成完了 | {storeId} | 棚割指示書が生成された |

## Event Detail

### EVT-001
- trigger: productRepository.create() 成功時
- payload_schema:
  ```json
  {
    "id": "uuid",
    "jan": "string | null",
    "name": "string",
    "width": "number",
    "height": "number",
    "depth": "number",
    "category": "string",
    "salesRank": "number"
  }
  ```
- publisher: ProductMaster コンポーネント
- subscriber: 商品一覧（UIリフレッシュ）

### EVT-004
- trigger: Excel/CSVインポート処理完了時
- payload_schema:
  ```json
  {
    "totalCount": "number",
    "importedCount": "number",
    "skippedCount": "number",
    "overwrittenCount": "number",
    "errors": ["string"]
  }
  ```
- publisher: ExcelImportModal コンポーネント
- subscriber: ProductMaster コンポーネント（一覧リフレッシュ）

### EVT-012
- trigger: 一括生成ボタン押下時
- payload_schema:
  ```json
  {
    "standardPlanogramId": "uuid",
    "storeIds": ["uuid"],
    "totalCount": "number"
  }
  ```
- publisher: StorePlanogramBatch コンポーネント
- subscriber: 進捗バーUI

### EVT-013
- trigger: 各店舗の生成処理完了時
- payload_schema:
  ```json
  {
    "current": "number",
    "total": "number",
    "storeId": "uuid",
    "status": "string"
  }
  ```
- publisher: automationService.batchGenerateStorePlanograms()
- subscriber: StorePlanogramBatch コンポーネント（進捗バー更新）

### EVT-014
- trigger: 全店舗の生成処理完了時
- payload_schema:
  ```json
  {
    "results": ["StorePlanogram"],
    "summary": {
      "total": "number",
      "success": "number",
      "warning": "number",
      "error": "number"
    }
  }
  ```
- publisher: automationService.batchGenerateStorePlanograms()
- subscriber: StorePlanogramBatch コンポーネント（結果レポート表示）

### EVT-016
- trigger: 同期ボタン押下→同期処理完了時
- payload_schema:
  ```json
  {
    "id": "uuid",
    "storeId": "uuid",
    "standardPlanogramId": "uuid",
    "status": "synced",
    "syncedAt": "datetime",
    "warnings": ["string"]
  }
  ```
- publisher: automationService.syncStorePlanogram()
- subscriber: StorePlanogramEditor コンポーネント（UI更新）

### EVT-021
- trigger: 商品追加/フェイス数増加で棚幅超過時
- payload_schema:
  ```json
  {
    "shelfIndex": "number",
    "currentWidth": "number",
    "maxWidth": "number",
    "remainingSpace": "number",
    "productName": "string"
  }
  ```
- publisher: StorePlanogramEditor / StandardPlanogramEditor コンポーネント
- subscriber: UIアラート表示

### EVT-023
- trigger: 什器配置時にAABB衝突検知
- payload_schema:
  ```json
  {
    "fixture1Id": "uuid",
    "fixture2Id": "uuid",
    "fixture1Name": "string",
    "fixture2Name": "string"
  }
  ```
- publisher: StoreLayoutEditor コンポーネント
- subscriber: UIアラート表示（配置ブロック）
