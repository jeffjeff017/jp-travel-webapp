-- Link trips to wishlist items so that when wishlist name/note is updated, trip description can sync
-- Run this in Supabase Dashboard → SQL Editor
ALTER TABLE trips ADD COLUMN IF NOT EXISTS wishlist_item_id integer REFERENCES wishlist_items(id) ON DELETE SET NULL;
