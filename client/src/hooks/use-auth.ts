// Simplified auth hook for Vercel deployment (no Replit auth)
// Replace with Clerk, NextAuth, or Supabase Auth for production

export function useAuth() {
  return {
    user: { id: "vercel-user", email: "", firstName: "User", lastName: "" },
    isLoading: false,
    isAuthenticated: true,
    logout: () => {},
    isLoggingOut: false,
  };
}
