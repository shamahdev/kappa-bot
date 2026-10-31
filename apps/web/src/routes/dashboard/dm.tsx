import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/dm")({
  component: () => <Navigate to="/dashboard/jobs" replace />,
});
