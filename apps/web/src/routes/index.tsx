import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LandingDemo } from '../components/landing-demo';
import { Button } from '../components/ui';
import { loginUrl } from '../lib/api';
import { useMe } from '../lib/queries';
import { useMounted } from '../lib/useMounted';

export const Route = createFileRoute('/')({
  component: LandingComponent,
  head: () => ({
    meta: [
      { title: 'Kappa — a focused job signal' },
      { name: 'description', content: 'Kappa turns your CV into a focused feed of roles worth your time.' },
    ],
  }),
});

function AuthAction() {
  const mounted = useMounted();
  const me = useMe();
  const navigate = useNavigate();
  // SSR and signed-out states show the static login link; only a positively
  // authenticated client swaps it for the dashboard link.
  if (mounted && me.data) {
    return <Button small onClick={() => void navigate({ to: '/dashboard' })}>Open dashboard</Button>;
  }
  return <Button small href={loginUrl}>Login with Discord</Button>;
}

function LandingComponent() {
  return <LandingDemo authAction={<AuthAction />} />;
}
