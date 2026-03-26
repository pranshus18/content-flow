import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'user';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Reset if no user
    if (!user) {
      setRole(null);
      setLoading(false);
      lastUserIdRef.current = null;
      fetchingRef.current = false;
      return;
    }

    // Only fetch if user changed (not if we already fetched for this user)
    const userId = user.id;
    if (lastUserIdRef.current === userId) {
      // Already fetched for this user, no need to fetch again
      return;
    }

    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      return;
    }

    // Mark as fetching and update last user ID
    fetchingRef.current = true;
    lastUserIdRef.current = userId;
    setLoading(true);

    // Fetch role
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching role:', error);
          // If no role found, default to user
          if (error.code === 'PGRST116') {
            setRole('user');
          } else {
            setRole('user'); // Default to user if error
          }
        } else {
          const userRole = data?.role as UserRole || 'user';
          setRole(userRole);
          console.log('✅ User role detected:', userRole, 'for user:', userId);
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        setRole('user');
      })
      .finally(() => {
        setLoading(false);
        fetchingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const isAdmin = role === 'admin';
  const isUser = role === 'user';

  // Refetch function
  const refetch = async () => {
    if (!user || fetchingRef.current) return;
    
    fetchingRef.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error refetching role:', error);
        setRole('user');
      } else {
        const userRole = data?.role as UserRole || 'user';
        setRole(userRole);
      }
    } catch (error) {
      console.error('Error:', error);
      setRole('user');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  return { role, isAdmin, isUser, loading, refetch };
}
