# Event Flow

## Flow List
| flow_id | description |
|---------|-------------|
| EF-001 | 個店棚割一括生成フロー |
| EF-002 | 個店棚割同期フロー |
| EF-003 | 標準棚割更新→個店棚割影響フロー |
| EF-004 | 商品インポート→マスタ更新フロー |
| EF-005 | 個店棚割手動調整フロー |
| EF-006 | 店舗什器配置フロー |

## Flow Detail

### EF-001
個店棚割一括生成フロー

1. event: BatchGenerationStarted (EVT-012)
   producer: StorePlanogramBatch
   consumer: 進捗バーUI（初期化）

2. event: BatchGenerationProgress (EVT-013) ×N回
   producer: automationService
   consumer: StorePlanogramBatch（進捗バー更新）

3. event: StorePlanogramGenerated (EVT-015) ×N回
   producer: automationService
   consumer: storePlanogramRepository（データ保存）

4. event: BatchGenerationCompleted (EVT-014)
   producer: automationService
   consumer: StorePlanogramBatch（結果レポート表示）

### EF-002
個店棚割同期フロー

1. event: StandardPlanogramUpdated (EVT-010)
   producer: StandardPlanogramEditor
   consumer: standardPlanogramRepository（データ保存）

2. event: StorePlanogramSynced (EVT-016)
   producer: automationService.syncStorePlanogram()
   consumer: StorePlanogramEditor（UI更新）、storePlanogramRepository（データ保存）

### EF-003
標準棚割更新→個店棚割影響フロー

1. event: StandardPlanogramUpdated (EVT-010)
   producer: StandardPlanogramEditor
   consumer: standardPlanogramRepository（データ保存）

2. event: （ユーザー操作待ち）
   producer: -
   consumer: StorePlanogramEditor（同期ボタン表示）

3. event: StorePlanogramSynced (EVT-016)
   producer: automationService.syncStorePlanogram()
   consumer: storePlanogramRepository（全商品データ置換）

### EF-004
商品インポート→マスタ更新フロー

1. event: （ファイル選択）
   producer: ExcelImportModal
   consumer: excelUtils（ファイル読み込み・パース）

2. event: （バリデーション実行）
   producer: excelUtils
   consumer: ExcelImportModal（プレビュー表示）

3. event: ProductsImported (EVT-004)
   producer: ExcelImportModal
   consumer: ProductMaster（商品一覧リフレッシュ）

4. event: ProductCreated (EVT-001) ×N回
   producer: productRepository
   consumer: ローカルストア/Supabase（データ永続化）

### EF-005
個店棚割手動調整フロー

1. event: ProductPlacedOnShelf (EVT-018)
   producer: StorePlanogramEditor（ドラッグ&ドロップ）
   consumer: 配置ロジック（positionX計算、フェイス数設定）

2. event: ShelfWidthOverflow (EVT-021) ※超過時のみ
   producer: StorePlanogramEditor
   consumer: UIアラート（残りスペース表示、操作ブロック）

3. event: FaceCountChanged (EVT-020) ※フェイス数±操作時
   producer: StorePlanogramEditor
   consumer: 棚幅再計算、UI更新

4. event: StorePlanogramManuallyEdited (EVT-017)
   producer: StorePlanogramEditor
   consumer: storePlanogramRepository（データ保存）

### EF-006
店舗什器配置フロー

1. event: FixturePlaced (EVT-022)
   producer: StoreLayoutEditor（ドラッグ&ドロップ）
   consumer: AABB衝突検知ロジック

2. event: FixtureCollisionDetected (EVT-023) ※衝突時のみ
   producer: StoreLayoutEditor
   consumer: UIアラート（配置ブロック、警告表示）

3. event: FixturePlaced (EVT-022) ※衝突なしの場合
   producer: StoreLayoutEditor
   consumer: storeFixturePlacementRepository（データ保存）
