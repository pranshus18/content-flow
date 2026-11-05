import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { invokeBackend } from '@/lib/backend';

export type UserRole = 'admin' | 'user';

type UserRoleContextValue = {
  role: UserRole | null;
  isAdmin: boolean;
  isUser: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
};

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

function useUserRoleController(): UserRoleContextValue {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setRole(null);
      setLoading(false);
      lastUserIdRef.current = null;
      fetchingRef.current = false;
      return;
    }

    const userId = user.id;
    if (lastUserIdRef.current === userId) {
      if (!fetchingRef.current) {
        setLoading(false);
      }
      return;
    }

    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    lastUserIdRef.current = userId;
    setLoading(true);

    invokeBackend<{ role: UserRole }>('me/role', undefined, { method: 'GET' })
      .then((data) => {
        setRole(data?.role || 'user');
      })
      .catch((error) => {
        console.error('Error fetching role:', error);
        setRole((current) => current ?? 'user');
      })
      .finally(() => {
        setLoading(false);
        fetchingRef.current = false;
      });
  }, [user?.id, authLoading]);

  const refetch = async () => {
    if (!user || fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);

    try {
      const data = await invokeBackend<{ role: UserRole }>('me/role', undefined, { method: 'GET' });
      setRole(data?.role || 'user');
    } catch (error) {
      console.error('Error:', error);
      setRole((current) => current ?? 'user');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  return {
    role,
    isAdmin: role === 'admin',
    isUser: role === 'user',
    loading,
    refetch,
  };
}

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const value = useUserRoleController();
  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within UserRoleProvider');
  }
  return context;
}
