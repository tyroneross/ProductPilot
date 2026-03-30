import { useState, useEffect, useCallback } from 'react';
import { authClient } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const result = await authClient.getSession();
      const session = result?.data || result;
      setUser(session?.user || null);
      setToken(session?.session?.token || session?.token || null);
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const signIn = async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    await refreshSession();
    return result;
  };

  const signUp = async (email: string, password: string, name: string) => {
    const result = await authClient.signUp.email({ email, password, name });
    await refreshSession();
    return result;
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setToken(null);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    token,
    signIn,
    signUp,
    signOut,
    logout: signOut, // backwards compat with admin page
  };
}
