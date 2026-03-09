-- store_planograms に width / height / shelf_count を追加
-- StorePlanogram 型が保持しているがテーブルに存在しなかったカラム

ALTER TABLE public.store_planograms
  ADD COLUMN IF NOT EXISTS width      decimal(8,2),
  ADD COLUMN IF NOT EXISTS height     decimal(8,2),
  ADD COLUMN IF NOT EXISTS shelf_count int;

-- standard_planograms に start_date / end_date / description を追加
-- StandardPlanogram 型が保持しているがテーブルに存在しなかったカラム

ALTER TABLE public.standard_planograms
  ADD COLUMN IF NOT EXISTS start_date  date,
  ADD COLUMN IF NOT EXISTS end_date    date,
  ADD COLUMN IF NOT EXISTS description text;
