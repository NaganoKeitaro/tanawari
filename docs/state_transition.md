# State Transition

## 1. Overview
棚割管理システムにおける主要なステート遷移を定義する。個店棚割のライフサイクル管理が中心となる。

## 2. State List
| state_id | state_name | description |
|----------|-----------|-------------|
| ST-001 | pending | 個店棚割の生成待ち状態。一括生成の対象として選択されたが処理未完了 |
| ST-002 | generated | 個店棚割の生成完了状態。ルールA/Bが正常に適用され、問題なく生成された |
| ST-003 | warning | 個店棚割の警告状態。生成は完了したが、カット対象商品の存在等の警告がある |
| ST-004 | error | 個店棚割のエラー状態。什器データ未設定等により生成に失敗した |
| ST-005 | synced | 個店棚割の同期済み状態。最新の標準棚割でルールA/Bが再適用された |

## 3. Transition List
| transition_id | from_state | to_state | trigger | condition |
|---------------|-----------|----------|---------|-----------|
| TR-001 | (初期) | pending | 個店棚割一括生成を開始 | 対象店舗として選択された |
| TR-002 | pending | generated | ルールA/B適用完了 | 警告なしで正常に生成された |
| TR-003 | pending | warning | ルールA/B適用完了 | カット対象商品が存在する等の警告あり |
| TR-004 | pending | error | ルールA/B適用失敗 | 什器データ未設定・寸法不正等 |
| TR-005 | generated | synced | 同期ボタン押下 | 最新の標準棚割でルールA/Bが再適用された |
| TR-006 | warning | synced | 同期ボタン押下 | 最新の標準棚割でルールA/Bが再適用された |
| TR-007 | synced | synced | 再同期ボタン押下 | 標準棚割が再度更新された後に再同期 |
| TR-008 | generated | warning | 手動調整後に棚幅超過 | 手動での商品追加により警告が発生 |
| TR-009 | error | generated | 什器データ設定後に再生成 | 不足データが補完された |
| TR-010 | error | warning | 什器データ設定後に再生成 | 再生成時に警告あり |
