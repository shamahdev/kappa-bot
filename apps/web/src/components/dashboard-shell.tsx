import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { guildIconUrl, userAvatarUrl } from "../lib/api";
import { useGuilds, useLogout, useRequireAuth } from "../lib/queries";
import { DashboardIcon } from "./dashboard-icon";
import { KappaMark } from "./kappa-mark";
import { Avatar, LoadingNote, QueryError, Select } from "./ui";

import "./dashboard-shell.css";

const PERSONAL_LINKS = [
  { to: "/dashboard", label: "Home", icon: "home" },
  { to: "/dashboard/jobs", label: "Jobs", icon: "jobs" },
  { to: "/dashboard/settings", label: "Settings", icon: "settings" },
] as const;

const PersonalNavigation = ({
  pathname,
  close,
}: {
  pathname: string;
  close: () => void;
}) => (
  <div className="dashboard-personal-links">
    {PERSONAL_LINKS.map(({ to, label, icon }) => (
      <Link
        key={to}
        to={to}
        activeOptions={{ exact: true }}
        aria-current={
          pathname.replace(/\/$/u, "") === to ||
          (to === "/dashboard" && pathname.startsWith("/dashboard/reports/"))
            ? "page"
            : undefined
        }
        className="dashboard-link"
        onClick={close}
      >
        <DashboardIcon name={icon} />
        <span>{label}</span>
      </Link>
    ))}
  </div>
);

const ServerNavigation = ({
  guild,
  active,
  settings,
  close,
}: {
  guild: NonNullable<ReturnType<typeof useGuilds>["data"]>[number];
  active: boolean;
  settings: boolean;
  close: () => void;
}) => (
  <nav
    aria-label={`${guild.name} navigation`}
    className="dashboard-server-links"
  >
    <div className="dashboard-server-name">
      <Avatar
        name={guild.name}
        src={guildIconUrl(guild.id, guild.icon) ?? undefined}
      />
      <span>{guild.name}</span>
    </div>
    <Link
      to="/dashboard/servers/$guildId/jobs"
      params={{ guildId: guild.id }}
      aria-current={active && !settings ? "page" : undefined}
      className="dashboard-link"
      onClick={close}
    >
      <DashboardIcon name="jobs" />
      <span>Jobs</span>
    </Link>
    <Link
      to="/dashboard/servers/$guildId/settings"
      params={{ guildId: guild.id }}
      aria-current={settings ? "page" : undefined}
      className="dashboard-link"
      onClick={close}
    >
      <DashboardIcon name="settings" />
      <span>Settings</span>
    </Link>
  </nav>
);

const SidebarContent = ({
  close,
  selectedGuildId,
  selectGuild,
}: {
  close: () => void;
  selectedGuildId?: string;
  selectGuild: (guildId: string) => void;
}) => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const me = useRequireAuth();
  const guilds = useGuilds(Boolean(me.data));
  const logout = useLogout();
  const routeGuildId = pathname.startsWith("/dashboard/servers/")
    ? pathname.split("/")[3]
    : undefined;
  const guild = guilds.data?.find((item) => item.id === selectedGuildId);
  const isServerSettings =
    Boolean(routeGuildId) && pathname.endsWith("/settings");
  const avatar = me.data
    ? userAvatarUrl(me.data.discordId, me.data.avatar)
    : null;

  return (
    <>
      <nav aria-label="Dashboard" className="dashboard-navigation">
        <PersonalNavigation pathname={pathname} close={close} />
        <div className="dashboard-server-section">
          <Select
            label="Server"
            description={
              guilds.isSuccess && guilds.data.length === 0
                ? "No managed servers available."
                : undefined
            }
            disabled={!guilds.isSuccess || guilds.data.length === 0}
            value={guild?.id ?? ""}
            options={[
              {
                value: "",
                label: guilds.isPending ? "Loading servers…" : "Pick a server",
              },
              ...(guilds.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
            onChange={(value) => {
              if (!value) {
                return;
              }
              selectGuild(value);
              void navigate({
                to: isServerSettings
                  ? "/dashboard/servers/$guildId/settings"
                  : "/dashboard/servers/$guildId/jobs",
                params: { guildId: value },
              });
              close();
            }}
          />
          {guilds.isError ? <QueryError error={guilds.error} /> : null}
          {guild ? (
            <ServerNavigation
              guild={guild}
              active={Boolean(routeGuildId)}
              settings={isServerSettings}
              close={close}
            />
          ) : null}
        </div>
      </nav>
      <div className="dashboard-sidebar-footer">
        {me.data ? (
          <div className="dashboard-user">
            <Avatar name={me.data.username} src={avatar ?? undefined} />
            <div>
              <strong>@{me.data.username}</strong>
              <span>Personal account</span>
            </div>
          </div>
        ) : null}
        <Link
          to="/dashboard/account"
          className="dashboard-link"
          aria-current={pathname === "/dashboard/account" ? "page" : undefined}
          onClick={close}
        >
          <DashboardIcon name="account" />
          <span>Account</span>
        </Link>
        <button
          type="button"
          className="dashboard-link"
          disabled={logout.isPending}
          aria-busy={logout.isPending || undefined}
          onClick={() => {
            logout.mutate(undefined, {
              onSettled: () => {
                close();
                void navigate({ to: "/" });
              },
            });
          }}
        >
          <DashboardIcon name="logout" />
          <span>{logout.isPending ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </>
  );
};

export const DashboardShell = () => {
  const me = useRequireAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pickedGuildId, setPickedGuildId] = useState<string | undefined>(
    undefined
  );
  const routeGuildId = pathname.startsWith("/dashboard/servers/")
    ? pathname.split("/")[3]
    : undefined;
  const selectedGuildId = routeGuildId ?? pickedGuildId;
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const close = () => setMobileOpen(false);

  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setMobileOpen(false);
    if (routeGuildId) {
      setPickedGuildId(routeGuildId);
    }
  }
  useEffect(() => {
    const element = drawer.current;
    if (!element) {
      return;
    }
    if (mobileOpen && !element.open) {
      element.showModal();
    }
    if (!mobileOpen && element.open) {
      element.close();
    }
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 60rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        setMobileOpen(false);
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previous;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const element = drawer.current;
    if (!element) {
      return;
    }
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target !== element) {
        return;
      }
      const bounds = element.getBoundingClientRect();
      if (
        event.clientX > bounds.right ||
        event.clientX < bounds.left ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        setMobileOpen(false);
      }
    };
    element.addEventListener("click", closeOnBackdrop);
    return () => element.removeEventListener("click", closeOnBackdrop);
  }, []);
  let content = <LoadingNote>Loading dashboard…</LoadingNote>;
  if (me.isError) {
    content = <QueryError error={me.error} />;
  } else if (me.data) {
    content = <Outlet />;
  }

  return (
    <div className="dashboard-shell">
      <a className="app-skip" href="#app-main">
        Skip to content
      </a>
      <aside className="dashboard-sidebar">
        <Link
          aria-label="Kappa home"
          className="app-wordmark dashboard-brand"
          to="/"
        >
          <KappaMark />
          kappa
        </Link>
        <SidebarContent
          close={close}
          selectedGuildId={selectedGuildId}
          selectGuild={setPickedGuildId}
        />
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-mobile-header">
          <Link aria-label="Kappa home" className="app-wordmark" to="/">
            <KappaMark />
            kappa
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="dashboard-menu-button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-navigation"
            onClick={() => setMobileOpen(true)}
          >
            <DashboardIcon name="menu" />
          </button>
        </header>
        <main className="dashboard-content" id="app-main">
          {content}
        </main>
      </div>
      <dialog
        ref={drawer}
        id="dashboard-mobile-navigation"
        className="dashboard-drawer"
        aria-label="Dashboard navigation"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          setMobileOpen(false);
          menuButton.current?.focus();
        }}
      >
        {mobileOpen ? (
          <>
            <div className="dashboard-drawer-header">
              <Link aria-label="Kappa home" className="app-wordmark" to="/">
                <KappaMark />
                kappa
              </Link>
              <button
                type="button"
                className="dashboard-menu-button"
                aria-label="Close navigation"
                onClick={close}
              >
                <DashboardIcon name="close" />
              </button>
            </div>
            <SidebarContent
              close={close}
              selectedGuildId={selectedGuildId}
              selectGuild={setPickedGuildId}
            />
          </>
        ) : null}
      </dialog>
    </div>
  );
};
