import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "../../components/ui";
import { loginUrl } from "../../lib/api";

export const Route = createFileRoute("/auth/error")({
  component: () => <AuthErrorComponent />,
});

const AuthErrorComponent = () => {
  const navigate = useNavigate();
  return (
    <Card padding={6}>
      <EmptyState
        actions={
          <>
            <Button href={loginUrl}>Try again</Button>
            <Button
              onClick={() => {
                void navigate({ to: "/" });
              }}
              small
              variant="subtle"
            >
              Back home
            </Button>
          </>
        }
        description="Discord didn't approve the sign-in, or the request expired. No account was created and nothing changed — try again, or head back home."
        title="Sign-in didn't go through"
      />
    </Card>
  );
};
