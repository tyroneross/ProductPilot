import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./use-auth";

export function useRequireAuth() {
  const auth = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      setLocation("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, setLocation]);

  return auth;
}
