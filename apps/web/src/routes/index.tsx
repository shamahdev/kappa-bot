import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LandingSoft } from "../components/landing-soft";
import { loginUrl } from "../lib/api";
import { useMe } from "../lib/queries";
import { useMounted } from "../lib/use-mounted";

export const Route = createFileRoute("/")({
  component: () => <LandingComponent />,
  head: () => ({
    meta: [
      { title: "Kappa | Your next job, in Discord" },
      {
        name: "description",
        content:
          "Create subscriptions by source, keywords, and location. New postings arrive in Discord.",
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
  return (
    <a className="app-button" href={loginUrl}>
      Login with Discord
    </a>
  );
};

const LandingComponent = () => (
  <LandingSoft primaryAction={<LandingAction />} />
);
