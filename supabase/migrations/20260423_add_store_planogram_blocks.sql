-- 個店棚割にブロック配置カラムを追加（棚ブロック入れ替え機能用）
-- JSONBで保存。NULLの場合は標準棚割のblocksを使用する
ALTER TABLE public.store_planograms
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT NULL;

COMMENT ON COLUMN public.store_planograms.blocks IS '個店用ブロック配置（入れ替え済み）。NULLの場合は標準棚割のblocksをフォールバック使用';
