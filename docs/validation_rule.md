# Validation Rules

## Rule List
| rule_id | target | condition | error_message |
|---------|--------|----------|---------------|
| VR-001 | Product.name | 必須・空文字不可 | 商品名は必須です |
| VR-002 | Product.width | 正の数値 | 幅は0より大きい数値を入力してください |
| VR-003 | Product.height | 正の数値 | 高さは0より大きい数値を入力してください |
| VR-004 | Product.depth | 正の数値 | 奥行きは0より大きい数値を入力してください |
| VR-005 | Product.salesRank | 1-100の整数 | 売上ランクは1-100の範囲で入力してください |
| VR-006 | Product.jan | JAN重複チェック | JANコード[{jan}]は既に登録されています |
| VR-007 | Store.name | 必須・空文字不可 | 店舗名は必須です |
| VR-008 | Store.fmt | FMT列挙値 | FMTはMEGA/SuC/SMART/GO/FCのいずれかを選択してください |
| VR-009 | Store.region | Region列挙値 | 地域を選択してください |
| VR-010 | Store.code | ユニーク制約 | 店舗コード[{code}]は既に使用されています |
| VR-011 | Fixture.name | 必須・空文字不可 | 什器名は必須です |
| VR-012 | Fixture.width | 正の数値 | 幅は0より大きい数値を入力してください |
| VR-013 | Fixture.height | 正の数値 | 高さは0より大きい数値を入力してください |
| VR-014 | Fixture.depth | 正の数値 | 奥行きは0より大きい数値を入力してください |
| VR-015 | Fixture.shelfCount | 1以上の整数 | 段数は1以上の整数を入力してください |
| VR-016 | Fixture.fixtureType | FixtureType列挙値 | 什器タイプを選択してください |
| VR-017 | ShelfBlock.name | 必須・空文字不可 | ブロック名は必須です |
| VR-018 | ShelfBlock.width | 正の数値 | 幅は0より大きい数値を入力してください |
| VR-019 | ShelfBlock.height | 正の数値 | 高さは0より大きい数値を入力してください |
| VR-020 | ShelfBlock.shelfCount | 1以上の整数 | 段数は1以上の整数を入力してください |
| VR-021 | ProductPlacement.shelfIndex | 0以上かつshelfCount未満 | 段インデックスが有効範囲外です |
| VR-022 | ProductPlacement.faceCount | 1以上の整数 | フェイス数は1以上を設定してください |
| VR-023 | ProductPlacement.positionX | 0以上かつblockWidth未満 | 配置位置がブロック幅を超えています |
| VR-024 | StandardPlanogram.name | 必須・空文字不可 | 棚割名は必須です |
| VR-025 | StandardPlanogram.fmt | FMT列挙値 | FMTを選択してください |
| VR-026 | StandardPlanogram.baseStoreId | 必須 | 基準店舗を選択してください |
| VR-027 | StandardPlanogram.width | 正の数値 | 幅は0より大きい数値を入力してください |
| VR-028 | StandardPlanogram.height | 正の数値 | 高さは0より大きい数値を入力してください |
| VR-029 | StandardPlanogram.shelfCount | 1以上の整数 | 段数は1以上の整数を入力してください |
| VR-030 | StandardPlanogram.startDate/endDate | startDate ≤ endDate | 開始日は終了日以前を設定してください |
| VR-031 | ShelfWidthOverflow | 段内商品幅合計 ≤ 棚割幅 | 棚幅を超えています。残りスペース: {remaining}mm |
| VR-032 | StoreFixturePlacement.collision | AABB衝突なし | 什器が重なっています。配置を調整してください |
| VR-033 | StoreFixturePlacement.direction | 0/90/180/270 | 回転角度は0/90/180/270のいずれかです |
| VR-034 | ImportFile.format | XLSX/CSV形式 | サポートされていないファイル形式です |
| VR-035 | ImportFile.columns | 必須カラム存在 | 必須カラム[{column}]が見つかりません |
| VR-036 | ImportFile.dataType | 数値フィールドが数値 | [{column}]の値[{value}]は数値ではありません |
| VR-037 | StorePlanogram.generation | 什器データ設定済み | 店舗[{storeName}]の什器データが設定されていません |
| VR-038 | FaceCountIncrement | 増加後も棚幅以内 | フェイス数を増加できません。残りスペース: {remaining}mm |

## Rule Detail

### VR-001
- target: Product.name
- condition: name != null AND name.trim() != ""
- error_message: 商品名は必須です
- severity: error

### VR-002
- target: Product.width
- condition: width > 0 AND isNumber(width)
- error_message: 幅は0より大きい数値を入力してください
- severity: error

### VR-003
- target: Product.height
- condition: height > 0 AND isNumber(height)
- error_message: 高さは0より大きい数値を入力してください
- severity: error

### VR-004
- target: Product.depth
- condition: depth > 0 AND isNumber(depth)
- error_message: 奥行きは0より大きい数値を入力してください
- severity: error

### VR-005
- target: Product.salesRank
- condition: salesRank >= 1 AND salesRank <= 100 AND isInteger(salesRank)
- error_message: 売上ランクは1-100の範囲で入力してください
- severity: error

### VR-006
- target: Product.jan
- condition: jan == "" OR NOT EXISTS(product WHERE product.jan == jan AND product.id != currentId)
- error_message: JANコード[{jan}]は既に登録されています
- severity: error

### VR-007
- target: Store.name
- condition: name != null AND name.trim() != ""
- error_message: 店舗名は必須です
- severity: error

### VR-008
- target: Store.fmt
- condition: fmt IN ['MEGA', 'SuC', 'SMART', 'GO', 'FC']
- error_message: FMTはMEGA/SuC/SMART/GO/FCのいずれかを選択してください
- severity: error

### VR-009
- target: Store.region
- condition: region IN ['北海道', '東北', '関東', '中部', '近畿', '中国・四国', '九州', '全地域']
- error_message: 地域を選択してください
- severity: error

### VR-010
- target: Store.code
- condition: NOT EXISTS(store WHERE store.code == code AND store.id != currentId)
- error_message: 店舗コード[{code}]は既に使用されています
- severity: error

### VR-011
- target: Fixture.name
- condition: name != null AND name.trim() != ""
- error_message: 什器名は必須です
- severity: error

### VR-012
- target: Fixture.width
- condition: width > 0 AND isNumber(width)
- error_message: 幅は0より大きい数値を入力してください
- severity: error

### VR-013
- target: Fixture.height
- condition: height > 0 AND isNumber(height)
- error_message: 高さは0より大きい数値を入力してください
- severity: error

### VR-014
- target: Fixture.depth
- condition: depth > 0 AND isNumber(depth)
- error_message: 奥行きは0より大きい数値を入力してください
- severity: error

### VR-015
- target: Fixture.shelfCount
- condition: shelfCount >= 1 AND isInteger(shelfCount)
- error_message: 段数は1以上の整数を入力してください
- severity: error

### VR-016
- target: Fixture.fixtureType
- condition: fixtureType IN ['multi-tier', 'flat-refrigerated', 'flat-frozen', 'end-cap-refrigerated', 'end-cap-frozen', 'gondola']
- error_message: 什器タイプを選択してください
- severity: error

### VR-017
- target: ShelfBlock.name
- condition: name != null AND name.trim() != ""
- error_message: ブロック名は必須です
- severity: error

### VR-018
- target: ShelfBlock.width
- condition: width > 0 AND isNumber(width)
- error_message: 幅は0より大きい数値を入力してください
- severity: error

### VR-019
- target: ShelfBlock.height
- condition: height > 0 AND isNumber(height)
- error_message: 高さは0より大きい数値を入力してください
- severity: error

### VR-020
- target: ShelfBlock.shelfCount
- condition: shelfCount >= 1 AND isInteger(shelfCount)
- error_message: 段数は1以上の整数を入力してください
- severity: error

### VR-021
- target: ProductPlacement.shelfIndex
- condition: shelfIndex >= 0 AND shelfIndex < parentBlock.shelfCount
- error_message: 段インデックスが有効範囲外です
- severity: error

### VR-022
- target: ProductPlacement.faceCount
- condition: faceCount >= 1 AND isInteger(faceCount)
- error_message: フェイス数は1以上を設定してください
- severity: error

### VR-023
- target: ProductPlacement.positionX
- condition: positionX >= 0 AND positionX < parentBlock.width
- error_message: 配置位置がブロック幅を超えています
- severity: error

### VR-024
- target: StandardPlanogram.name
- condition: name != null AND name.trim() != ""
- error_message: 棚割名は必須です
- severity: error

### VR-025
- target: StandardPlanogram.fmt
- condition: fmt IN ['MEGA', 'SuC', 'SMART', 'GO', 'FC']
- error_message: FMTを選択してください
- severity: error

### VR-026
- target: StandardPlanogram.baseStoreId
- condition: baseStoreId != null AND baseStoreId != ""
- error_message: 基準店舗を選択してください
- severity: error

### VR-027
- target: StandardPlanogram.width
- condition: width > 0 AND isNumber(width)
- error_message: 幅は0より大きい数値を入力してください
- severity: error

### VR-028
- target: StandardPlanogram.height
- condition: height > 0 AND isNumber(height)
- error_message: 高さは0より大きい数値を入力してください
- severity: error

### VR-029
- target: StandardPlanogram.shelfCount
- condition: shelfCount >= 1 AND isInteger(shelfCount)
- error_message: 段数は1以上の整数を入力してください
- severity: error

### VR-030
- target: StandardPlanogram.startDate/endDate
- condition: startDate == null OR endDate == null OR startDate <= endDate
- error_message: 開始日は終了日以前を設定してください
- severity: error

### VR-031
- target: ShelfWidthOverflow（段内商品幅合計）
- condition: SUM(product.width * product.faceCount FOR product IN shelfProducts) <= planogram.width
- error_message: 棚幅を超えています。残りスペース: {remaining}mm
- severity: error

### VR-032
- target: StoreFixturePlacement（什器衝突検知）
- condition: NOT checkAABBCollision(newFixture, existingFixture) FOR ALL existingFixtures
- error_message: 什器が重なっています。配置を調整してください
- severity: error

### VR-033
- target: StoreFixturePlacement.direction
- condition: direction IN [0, 90, 180, 270]
- error_message: 回転角度は0/90/180/270のいずれかです
- severity: error

### VR-034
- target: ImportFile.format
- condition: fileExtension IN ['.xlsx', '.csv']
- error_message: サポートされていないファイル形式です
- severity: error

### VR-035
- target: ImportFile.columns
- condition: requiredColumns.every(col => fileColumns.includes(col))
- error_message: 必須カラム[{column}]が見つかりません
- severity: error

### VR-036
- target: ImportFile.dataType
- condition: isNumber(value) WHERE column.type == 'number'
- error_message: [{column}]の値[{value}]は数値ではありません
- severity: warning

### VR-037
- target: StorePlanogram.generation
- condition: getStoreFixtures(storeId).length > 0
- error_message: 店舗[{storeName}]の什器データが設定されていません
- severity: error

### VR-038
- target: FaceCountIncrement
- condition: currentShelfWidth + product.width <= planogram.width
- error_message: フェイス数を増加できません。残りスペース: {remaining}mm
- severity: error
