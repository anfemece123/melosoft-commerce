import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppDispatch } from '@/app/hooks';
import { setUser, setProfile, setBootstrapping, logout } from './authSlice';
import { setMyMemberships } from '@/features/stores/storesSlice';
import { authService } from './authService';
import { storesService } from '@/features/stores/storesService';

/**
 * Initializes auth state on first load and listens to Supabase auth changes.
 * Loads profile + memberships so route guards can evaluate role and store access.
 *
 * Call once at the app root (App.tsx).
 */
export function useAuthBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function restoreSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        dispatch(setUser({ id: session.user.id, email: session.user.email ?? '' }));
        try {
          const [profile, memberships] = await Promise.all([
            authService.getCurrentProfile(session.user.id),
            storesService.getMyMemberships(),
          ]);
          dispatch(setProfile(profile));
          dispatch(setMyMemberships(memberships));
        } catch {
          // Keep initial null/[] — don't overwrite with stale data
        }
      }

      // Bootstrap complete — route guards can now evaluate auth + role state
      dispatch(setBootstrapping(false));
    }

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // INITIAL_SESSION is handled by restoreSession — skip to avoid race condition
        if (event === 'INITIAL_SESSION') return;

        if (session?.user) {
          dispatch(setUser({ id: session.user.id, email: session.user.email ?? '' }));
          // Reload profile + memberships on subsequent auth changes (login, token refresh, etc.)
          Promise.all([
            authService.getCurrentProfile(session.user.id),
            storesService.getMyMemberships(),
          ])
            .then(([profile, memberships]) => {
              dispatch(setProfile(profile));
              dispatch(setMyMemberships(memberships));
            })
            .catch(() => {
              // Don't clear on error — keep existing state
            });
        } else {
          dispatch(logout());
        }
      }
    );

    return () => { subscription.unsubscribe(); };
  }, [dispatch]);
}
