import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button, HStack, PageHeader, Text } from "../../components/ui";
import { loginUrl } from "../../lib/api";

export const Route = createFileRoute("/auth/error")({
  head: () => ({ meta: [{ title: "Sign-in error | Kappa" }] }),
  component: () => <AuthErrorComponent />,
});

const AuthErrorComponent = () => {
  const navigate = useNavigate();
  return (
    <section className="app-stack">
      <PageHeader title="Sign-in didn't go through" />
      <Text as="p" color="secondary">
        Discord didn&apos;t approve the sign-in, or the request expired. Try
        again, or head back home.
      </Text>
      <HStack gap={3} wrap="wrap">
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
      </HStack>
    </section>
  );
};
