-- Script de migração para adicionar colunas de vistoria
ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS start_inspection_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS end_inspection_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS start_inspection_notes text,
ADD COLUMN IF NOT EXISTS end_inspection_notes text;
