import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase URL ou Anon Key ausentes! Verifique as variáveis de ambiente (.env ou na Vercel).')
}

export const supabase = createClient(
  supabaseUrl || 'https://xyz.supabase.co', 
  supabaseAnonKey || 'public-anon-key'
)
