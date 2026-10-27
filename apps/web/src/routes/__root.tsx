import { AppShell } from "@astryxdesign/core/AppShell";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Link as RouterLink,
  Outlet,
  Scripts,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useMemo } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import "../styles.css";
import { Button } from "../components/ui";
import { loginUrl } from "../lib/api";
import { useLogout, useMe } from "../lib/queries";
import { useMounted } from "../lib/use-mounted";
import { kappaTheme } from "../themes/built/kappa";

import styles from "./root.module.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kappa — job subscriptions" },
    ],
  }),
  component: () => <RootComponent />,
});

/** App routes use the router; API login and external links keep native navigation. */
const AppLink = ({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  if (
    href?.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/api/")
  ) {
    return (
      <RouterLink {...props} activeOptions={{ exact: true }} to={href}>
        {children}
      </RouterLink>
    );
  }
  return (
    <a {...props} href={href}>
      {children}
    </a>
  );
};

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
    <TopNav
      heading={<TopNavHeading heading="Kappa" headingHref="/" />}
      label="Account"
      startContent={
        signedIn ? (
          <>
            <TopNavItem
              href="/dashboard"
              isSelected={pathname.startsWith("/dashboard") && !isSettings}
              label="Dashboard"
            />
            <TopNavItem
              href="/dashboard/settings"
              isSelected={isSettings}
              label="Settings"
            />
          </>
        ) : undefined
      }
      endContent={accountAction}
    />
  );
};

const RootComponent = () => {
  const queryClient = useMemo(() => new QueryClient(), []);
  return (
    <html data-astryx-theme="kappa" data-theme="light" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Theme mode="light" theme={kappaTheme}>
            <LinkProvider component={AppLink}>
              <div className={styles.shell}>
                <AppShell
                  height="auto"
                  topNav={<Navigation />}
                  variant="section"
                >
                  <div className={styles.content}>
                    <Outlet />
                  </div>
                </AppShell>
                <footer className={styles.footer}>
                  <div className={styles.footerInner}>
                    <Text color="secondary" type="supporting">
                      Kappa job subscriptions
                    </Text>
                    <Text color="secondary" type="supporting">
                      Delivery happens in Discord; this dashboard manages it.
                    </Text>
                  </div>
                </footer>
              </div>
            </LinkProvider>
          </Theme>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
};
