import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const raw = await res.text();
    let body: unknown = raw;
    let serverMessage: string | undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        body = parsed;
        if (parsed && typeof parsed === "object") {
          const m = (parsed as Record<string, unknown>).message ?? (parsed as Record<string, unknown>).error;
          if (typeof m === "string" && m.trim().length > 0) serverMessage = m;
        }
      } catch {
        // body is plain text; raw stays as-is
      }
    }
    const friendly = serverMessage || raw || res.statusText || `Request failed (${res.status})`;
    throw new ApiError(res.status, body, friendly);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  _token?: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000, // 30 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
