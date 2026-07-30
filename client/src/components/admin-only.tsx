import { lazy, Suspense, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const NotFound = lazy(() => import("@/pages/not-found"));

type AdminCheck = { isAdmin: boolean };

/**
 * Renders an admin page only for an admin, and the ordinary 404 for everyone else.
 *
 * The admin routes were previously registered unconditionally with no guard, so
 * any visitor typing /admin loaded the full admin shell. The server 403s the
 * data, so nothing leaked — but the surface was reachable and its existence
 * confirmed to anyone who guessed the path.
 *
 * Deliberately renders NotFound rather than "Forbidden": a 403-style screen
 * tells an unauthorized visitor that the route is real and worth attacking.
 * A non-admin should not be able to distinguish /admin from /asdf.
 *
 * The server-side `isAdmin` middleware remains the actual security boundary —
 * this only removes the surface. A client check alone is never a control.
 */
export function AdminOnly({ component: Component }: { component: ComponentType }) {
  const { data, isLoading, isError } = useQuery<AdminCheck>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      // 401 for signed-out users is expected, not exceptional — treat any
      // failure as "not an admin" rather than surfacing an error state that
      // would itself reveal the route exists.
      try {
        const res = await apiRequest("GET", "/api/admin/check");
        return (await res.json()) as AdminCheck;
      } catch {
        return { isAdmin: false };
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  // Never render the admin UI while the answer is unknown. A neutral frame
  // here, not a spinner branded as admin.
  if (isLoading) {
    return <div className="min-h-screen" style={{ background: "#110f0d" }} aria-busy="true" />;
  }

  if (isError || !data?.isAdmin) {
    return (
      <Suspense fallback={<div className="min-h-screen" style={{ background: "#110f0d" }} />}>
        <NotFound />
      </Suspense>
    );
  }

  return <Component />;
}
