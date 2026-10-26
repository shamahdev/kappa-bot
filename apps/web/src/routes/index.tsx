import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LandingDemo } from "../components/landing-demo";
import { Button } from "../components/ui";
import { loginUrl } from "../lib/api";
import { useMe } from "../lib/queries";
import { useMounted } from "../lib/use-mounted";

export const Route = createFileRoute("/")({
  component: () => <LandingComponent />,
  head: () => ({
    meta: [
      { title: "Kappa — a focused job signal" },
      {
        name: "description",
        content:
          "Kappa ranks new job postings against your CV and sends the strongest matches to Discord.",
      },
    ],
  }),
});

const AuthAction = () => {
  const mounted = useMounted();
  const me = useMe();
  const navigate = useNavigate();
  // SSR and signed-out states show the static login link; only a positively
  // authenticated client swaps it for the dashboard link.
  if (mounted && me.data) {
    return (
      <Button
        onClick={() => {
          void navigate({ to: "/dashboard" });
        }}
        small
      >
        Open dashboard
      </Button>
    );
  }
  return (
    <Button href={loginUrl} small>
      Login with Discord
    </Button>
  );
};

const LandingComponent = () => <LandingDemo authAction={<AuthAction />} />;
