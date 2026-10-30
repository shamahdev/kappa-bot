import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LandingSoft } from "../components/landing-soft";
import { DiscordLogin } from "../components/ui";
import { useMe } from "../lib/queries";
import { useMounted } from "../lib/use-mounted";

export const Route = createFileRoute("/")({
  component: () => <LandingComponent />,
  head: () => ({
    meta: [
      { title: "Kappa | Job matches, delivered to you" },
      {
        name: "description",
        content:
          "Get notified in Discord when new jobs match your keywords or CV. Spend less time checking job sites.",
      },
    ],
  }),
});

const LandingAction = () => {
  const mounted = useMounted();
  const me = useMe();
  const navigate = useNavigate();
  // Keep the signed-out action available during SSR; authenticated clients
  // use the existing dashboard destination.
  if (mounted && me.data) {
    return (
      <button
        className="app-button"
        onClick={() => {
          void navigate({ to: "/dashboard" });
        }}
        type="button"
      >
        Open dashboard
      </button>
    );
  }
  return <DiscordLogin />;
};

const LandingComponent = () => (
  <LandingSoft primaryAction={<LandingAction />} />
);
