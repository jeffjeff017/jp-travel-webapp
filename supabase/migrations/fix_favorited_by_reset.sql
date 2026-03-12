-- Optional: Fix wishlist items that had favorited_by incorrectly set when adding
-- (Old logic auto-added the creator to favorited_by; it should only show when user presses like)
-- Run this in Supabase Dashboard → SQL Editor if you see "讚好" bubble on unliked items
-- Only clears rows where favorited_by equals [added_by.username] (the bogus auto-like)
UPDATE wishlist_items
SET favorited_by = '[]'::jsonb
WHERE added_by IS NOT NULL
  AND favorited_by IS NOT NULL
  AND jsonb_array_length(favorited_by) = 1
  AND favorited_by->>0 = added_by->>'username';
