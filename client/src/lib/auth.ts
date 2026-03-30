// Auth client that proxies through our Express backend (avoids cross-origin cookie issues)
export const authClient = {
  signIn: {
    email: async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Sign-in failed');
      }
      return res.json();
    },
    social: async ({ provider, callbackURL }: { provider: string; callbackURL: string }) => {
      // For Google OAuth, redirect to our backend proxy which handles the flow
      return { data: { url: `/api/auth/google` } };
    },
  },
  signUp: {
    email: async ({ email, password, name }: { email: string; password: string; name: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Sign-up failed');
      }
      return res.json();
    },
  },
  getSession: async () => {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) return { data: null };
    const data = await res.json();
    return { data };
  },
  signOut: async () => {
    // Clear local session
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' }).catch(() => {});
  },
};
