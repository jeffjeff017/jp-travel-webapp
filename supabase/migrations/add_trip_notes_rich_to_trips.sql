-- 行程富文本（Plate JSON），與 description（行程明細 JSON）分開儲存
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS trip_notes_rich text;

COMMENT ON COLUMN public.trips.trip_notes_rich IS 'Plate/Slate editor JSON for optional trip notes shown under address on trip detail';
