import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Button } from '../../components/ui';
import { loginUrl } from '../../lib/api';

export const Route = createFileRoute('/auth/error')({ component: AuthErrorComponent });

function AuthErrorComponent() {
  const navigate = useNavigate();
  return (
    <Card padding={6}>
      <EmptyState
        title="Sign-in didn't go through"
        description="Discord didn't approve the sign-in, or the request expired. No account was created and nothing changed — try again, or head back home."
        actions={
          <>
            <Button href={loginUrl}>Try again</Button>
            <Button variant="subtle" small onClick={() => void navigate({ to: '/' })}>
              Back home
            </Button>
          </>
        }
      />
    </Card>
  );
}
