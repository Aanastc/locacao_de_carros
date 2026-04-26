-- Atualização da Tabela de Aluguéis para suportar Horas e CNH
-- Este script foi gerado automaticamente e é seguro para rodar.

-- 1. Adicionar coluna CNH do Cliente
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS client_cnh text;

-- 2. Alterar colunas de data para suportar data e hora exatas
ALTER TABLE public.rentals ALTER COLUMN start_date TYPE timestamp with time zone USING start_date::timestamp with time zone;
ALTER TABLE public.rentals ALTER COLUMN expected_end_date TYPE timestamp with time zone USING expected_end_date::timestamp with time zone;
ALTER TABLE public.rentals ALTER COLUMN actual_end_date TYPE timestamp with time zone USING actual_end_date::timestamp with time zone;
