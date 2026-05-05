import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cvfsgutgbiukdxfmaijq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_wrIc5uCUDKgmxOxGzsRChA_c4JJZecR'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)