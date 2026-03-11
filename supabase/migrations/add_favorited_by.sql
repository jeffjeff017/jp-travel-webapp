-- Per-user likes: each user's like is independent, cancelling does not affect others
-- Run this in Supabase Dashboard → SQL Editor
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS favorited_by jsonb DEFAULT '[]'::jsonb;
