-- Remove the category check constraint so any category value is allowed
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_category_check;
