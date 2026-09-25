-- Add image_urls column to prompts to support multi-image prompt uploads
alter table public.prompts
  add column if not exists image_urls text[];
