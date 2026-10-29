import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useMemo } from "react";
import type { ReactNode } from "react";

import "../styles.css";
import { Button } from "../components/ui";
import { loginUrl } from "../lib/api";
import { useLogout, useMe } from "../lib/queries";
import { useMounted } from "../lib/use-mounted";

export const Route = createRootRoute({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap",
      },
    ],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kappa | Job subscriptions" },
      {
        name: "description",
        content:
          "Follow job listings in Discord and manage your subscriptions with Kappa.",
      },
    ],
  }),
  component: () => <RootComponent />,
});

const Navigation = () => {
  const mounted = useMounted();
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const signedIn = mounted && Boolean(me.data);
  const isSettings = pathname === "/dashboard/settings";
  let accountAction: ReactNode = null;
  if (signedIn) {
    accountAction = (
      <Button
        disabled={logout.isPending}
        loading={logout.isPending}
        onClick={() => {
          logout.mutate(undefined, {
            onSettled: () => {
              void navigate({ to: "/" });
            },
          });
        }}
        small
        variant="subtle"
      >
        {logout.isPending ? "Signing out…" : "Sign out"}
      </Button>
    );
  } else if (mounted && !me.isPending) {
    accountAction = (
      <Button href={loginUrl} small variant="subtle">
        Log in with Discord
      </Button>
    );
  }
  return (
    <header className="app-nav">
      <nav aria-label="Account" className="app-nav-inner">
        <Link aria-label="Kappa home" className="app-wordmark" to="/">
          <span aria-hidden="true" className="app-logo">
            κ
          </span>
          kappa
        </Link>
        <div className="app-nav-links">
          {signedIn ? (
            <>
              <Link
                activeOptions={{ exact: true }}
                aria-current={
                  !isSettings && pathname.startsWith("/dashboard")
                    ? "page"
                    : undefined
                }
                className="app-nav-link"
                to="/dashboard"
              >
                Dashboard
              </Link>
              <Link
                activeOptions={{ exact: true }}
                aria-current={isSettings ? "page" : undefined}
                className="app-nav-link"
                to="/dashboard/settings"
              >
                Settings
              </Link>
            </>
          ) : null}
          {accountAction}
        </div>
      </nav>
    </header>
  );
};

const RootComponent = () => {
  const queryClient = useMemo(() => new QueryClient(), []);
  const pathname = useLocation({ select: (location) => location.pathname });
  const isLanding = pathname === "/";
  return (
    <html data-theme="kappa-soft" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {isLanding ? (
            <Outlet />
          ) : (
            <div className="app-shell">
              <Navigation />
              <main className="app-content">
                <Outlet />
              </main>
            </div>
          )}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
};
