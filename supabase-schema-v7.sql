-- ============================================================
-- ASSET TRACKER — Update category constraint
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Drop the old category check constraint
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_category_check;

-- Add new constraint with all categories
ALTER TABLE public.assets ADD CONSTRAINT assets_category_check CHECK (category IN (
  'AIR CONDITIONER', 'AIR PURIFIER', 'AR HEADSET', 'CAMERA', 'DESKTOP',
  'EV CHARGER', 'FAN', 'HAND DRYER', 'HOTSPOT DEVICE', 'KEYBOARD',
  'LAPTOP', 'LENS', 'LIGHTING', 'MICROPHONE', 'MOUSE', 'PHONE',
  'PORTABLE STORAGE', 'PRINTER', 'PROJECTOR', 'RECORDER', 'REFRIGERATOR',
  'ROUTER', 'SCANNER', 'SHREDDER', 'SPEAKERS', 'STREAMING DEVICE',
  'TABLET', 'TRASHCAN', 'TV', 'USB HUB', 'VC', 'WEBCAM',
  'Tools & Equipment', 'IT Equipment'
));
