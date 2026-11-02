import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Jobs section: board (index) and delivered job list, via sidebar subitems. */
export const Route = createFileRoute("/dashboard/jobs")({
  component: Outlet,
});
