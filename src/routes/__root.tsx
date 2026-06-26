import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AuthContext, type AuthUser, getStoredAuth, setStoredAuth, clearStoredAuth } from "@/lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-amber-400">404</h1>
        <p className="mt-3 text-muted-foreground">This medal isn&apos;t on the podium.</p>
        <Link to="/" className="mt-6 inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">
          Back to leaderboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Something spilled.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black">
            Try again
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">Leaderboard</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [user, setUserState] = useState<AuthUser | null>(() => getStoredAuth());

  function setUser(u: AuthUser | null) {
    setUserState(u);
    if (u) setStoredAuth(u);
    else clearStoredAuth();
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster theme="dark" position="top-center" richColors />
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
