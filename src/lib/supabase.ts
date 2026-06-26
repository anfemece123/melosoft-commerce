import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { env } from './env';

export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder'
);
