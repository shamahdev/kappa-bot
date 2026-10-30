import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { KappaMark } from "../../components/kappa-mark";
import {
  Button,
  DiscordLogin,
  HStack,
  PageHeader,
  Text,
} from "../../components/ui";

export const Route = createFileRoute("/auth/error")({
  head: () => ({ meta: [{ title: "Sign-in error | Kappa" }] }),
  component: () => <AuthErrorComponent />,
});

const AuthErrorComponent = () => {
  const navigate = useNavigate();
  return (
    <section className="app-stack app-auth-error">
      <KappaMark className="app-auth-mascot" />
      <PageHeader title="Sign-in didn't go through" />
      <Text as="p" color="secondary">
        Discord didn&apos;t approve the sign-in, or the request expired. Try
        again, or head back home.
      </Text>
      <HStack gap={3} wrap="wrap">
        <DiscordLogin label="Try Discord again" />
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
