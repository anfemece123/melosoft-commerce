import { supabase } from '@/lib/supabase';
import type { LoginCredentials, AuthUser, Profile } from './auth.types';
import { mapProfileRowToProfile } from './auth.mapper';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('No se recibió usuario de Supabase');

    return {
      id: data.user.id,
      email: data.user.email ?? credentials.email,
    };
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getSession(): Promise<AuthUser | null> {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw new Error(error.message);
    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email ?? '',
    };
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) return null;
    if (!user) return null;

    return {
      id: user.id,
      email: user.email ?? '',
    };
  },

  async getCurrentProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapProfileRowToProfile(data);
  },
};
