import { createFileRoute, Navigate } from "@tanstack/react-router";

const ServerIndex = () => {
  const params = Route.useParams();
  return (
    <Navigate to="/dashboard/servers/$guildId/jobs" params={params} replace />
  );
};

export const Route = createFileRoute("/dashboard/servers/$guildId/")({
  component: ServerIndex,
});
