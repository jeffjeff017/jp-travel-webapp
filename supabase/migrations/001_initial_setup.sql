-- =============================================
-- Japan Travel App - Supabase Database Setup
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. Site Settings (singleton: id=1)
-- =============================================
CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  title text NOT NULL DEFAULT '日本行程規劃',
  home_location jsonb DEFAULT null,
  trip_start_date text DEFAULT null,
  total_days integer DEFAULT 5,
  day_schedules jsonb DEFAULT null,
  travel_essentials jsonb DEFAULT null,
  travel_preparations jsonb DEFAULT null,
  recaptcha_enabled boolean DEFAULT false,
  sakura_mode_enabled boolean DEFAULT false,
  chiikawa_messages jsonb DEFAULT null,
  flights jsonb DEFAULT '[]'::jsonb,
  day_heart_counts jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings row if not exists
INSERT INTO site_settings (id, title, total_days) VALUES (1, '日本行程規劃', 5)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. Users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  display_name text DEFAULT null,
  avatar_url text DEFAULT null,
  created_at timestamptz DEFAULT now()
);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password, role, display_name) VALUES ('admin', 'admin123', 'admin', '管理員')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- 3. Trips / Itinerary
-- =============================================
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  title text NOT NULL,
  date text NOT NULL,
  time_start text DEFAULT null,
  time_end text DEFAULT null,
  description text NOT NULL DEFAULT '[]',
  trip_notes_rich text DEFAULT null,
  location text NOT NULL,
  lat numeric NOT NULL DEFAULT 0,
  lng numeric NOT NULL DEFAULT 0,
  image_url text DEFAULT null,
  wishlist_item_id integer DEFAULT null,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_wishlist_item FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_items(id) ON DELETE SET NULL
);

-- =============================================
-- 4. Wishlist Items (美食/景點清單)
-- =============================================
CREATE TABLE IF NOT EXISTS wishlist_items (
  id SERIAL PRIMARY KEY,
  category text NOT NULL DEFAULT 'food',
  name text NOT NULL,
  note text DEFAULT null,
  image_url text DEFAULT null,
  map_link text DEFAULT null,
  link text DEFAULT null,
  added_to_trip jsonb DEFAULT null,
  added_by jsonb DEFAULT null,
  is_favorite boolean DEFAULT false,
  favorited_by jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 5. Checklist States
-- =============================================
CREATE TABLE IF NOT EXISTS checklist_states (
  id text PRIMARY KEY,
  checked_by jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 6. Destinations (多目的地支援)
-- =============================================
CREATE TABLE IF NOT EXISTS destinations (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_en text NOT NULL,
  flag text NOT NULL,
  theme jsonb NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default destinations
INSERT INTO destinations (id, name, name_en, flag, theme, is_active, sort_order) VALUES
  ('japan', '日本', 'Japan', '🇯🇵', '{"primary":"sakura","primaryHex":"#F472B6","secondary":"pink","secondaryHex":"#EC4899","accent":"rose","accentHex":"#F43F5E","gradient":"from-pink-400 to-rose-500","emoji":"🌸"}', true, 1),
  ('thailand', '泰國', 'Thailand', '🇹🇭', '{"primary":"thai","primaryHex":"#F59E0B","secondary":"amber","secondaryHex":"#D97706","accent":"orange","accentHex":"#EA580C","gradient":"from-amber-400 to-orange-500","emoji":"🐘"}', true, 2),
  ('korea', '韓國', 'Korea', '🇰🇷', '{"primary":"korean","primaryHex":"#3B82F6","secondary":"blue","secondaryHex":"#2563EB","accent":"indigo","accentHex":"#4F46E5","gradient":"from-blue-400 to-indigo-500","emoji":"🏯"}', true, 3),
  ('taiwan', '台灣', 'Taiwan', '🇹🇼', '{"primary":"taiwan","primaryHex":"#10B981","secondary":"emerald","secondaryHex":"#059669","accent":"teal","accentHex":"#14B8A6","gradient":"from-emerald-400 to-teal-500","emoji":"🧋"}', true, 4)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 7. Expenses (旅行錢包)
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('personal', 'shared')),
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_url text DEFAULT null,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'other',
  note text DEFAULT null,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 8. Wallet Settings
-- =============================================
CREATE TABLE IF NOT EXISTS wallet_settings (
  id integer PRIMARY KEY DEFAULT 1,
  shared_budget numeric DEFAULT 0,
  currency text DEFAULT 'JPY',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO wallet_settings (id, shared_budget, currency) VALUES (1, 0, 'JPY')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Row Level Security (RLS) Policies
-- Enable RLS and set permissive policies for development
-- =============================================

-- Enable RLS on all tables
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (app is mostly public read)
DROP POLICY IF EXISTS "Allow public read site_settings" ON site_settings;
CREATE POLICY "Allow public read site_settings" ON site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert site_settings" ON site_settings;
CREATE POLICY "Allow public insert site_settings" ON site_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update site_settings" ON site_settings;
CREATE POLICY "Allow public update site_settings" ON site_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public read users" ON users;
CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert users" ON users;
CREATE POLICY "Allow public insert users" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update users" ON users;
CREATE POLICY "Allow public update users" ON users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete users" ON users;
CREATE POLICY "Allow public delete users" ON users FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read trips" ON trips;
CREATE POLICY "Allow public read trips" ON trips FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert trips" ON trips;
CREATE POLICY "Allow public insert trips" ON trips FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update trips" ON trips;
CREATE POLICY "Allow public update trips" ON trips FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete trips" ON trips;
CREATE POLICY "Allow public delete trips" ON trips FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read wishlist_items" ON wishlist_items;
CREATE POLICY "Allow public read wishlist_items" ON wishlist_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert wishlist_items" ON wishlist_items;
CREATE POLICY "Allow public insert wishlist_items" ON wishlist_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update wishlist_items" ON wishlist_items;
CREATE POLICY "Allow public update wishlist_items" ON wishlist_items FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete wishlist_items" ON wishlist_items;
CREATE POLICY "Allow public delete wishlist_items" ON wishlist_items FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read checklist_states" ON checklist_states;
CREATE POLICY "Allow public read checklist_states" ON checklist_states FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert checklist_states" ON checklist_states;
CREATE POLICY "Allow public insert checklist_states" ON checklist_states FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update checklist_states" ON checklist_states;
CREATE POLICY "Allow public update checklist_states" ON checklist_states FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public read destinations" ON destinations;
CREATE POLICY "Allow public read destinations" ON destinations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read expenses" ON expenses;
CREATE POLICY "Allow public read expenses" ON expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert expenses" ON expenses;
CREATE POLICY "Allow public insert expenses" ON expenses FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update expenses" ON expenses;
CREATE POLICY "Allow public update expenses" ON expenses FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete expenses" ON expenses;
CREATE POLICY "Allow public delete expenses" ON expenses FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read wallet_settings" ON wallet_settings;
CREATE POLICY "Allow public read wallet_settings" ON wallet_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public update wallet_settings" ON wallet_settings;
CREATE POLICY "Allow public update wallet_settings" ON wallet_settings FOR UPDATE USING (true);

-- =============================================
-- Done!
-- =============================================
