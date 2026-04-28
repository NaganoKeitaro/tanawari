-- 什器タイプの変更: gondola廃止 → multi-tier統合、wall-flat-refrigerated新規追加
-- 既存データのgondolaをmulti-tierに移行

-- fixtures テーブル
UPDATE public.fixtures
  SET fixture_type = 'multi-tier'
  WHERE fixture_type = 'gondola';

-- standard_planograms テーブル
UPDATE public.standard_planograms
  SET fixture_type = 'multi-tier'
  WHERE fixture_type = 'gondola';

-- shelf_blocks テーブル（block_type カラム）
-- gondola相当のブロックがあれば multi-tier に統合
-- また wall-flat を新しい block_type として使用可能にする（既存データ変更不要）
