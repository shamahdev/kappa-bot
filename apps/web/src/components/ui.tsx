import { Badge as AstryxBadge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button as AstryxButton } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot as AstryxStatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { TextInput as AstryxTextInput } from '@astryxdesign/core/TextInput';
import * as stylex from '@stylexjs/stylex';
import type { ChangeEventHandler, MouseEventHandler, ReactNode } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { loginUrl } from '../lib/api';
import { ApiError, apiMessage } from '../lib/queries';

type ButtonVariant = 'primary' | 'brand' | 'subtle' | 'danger' | 'dangerSubtle';

const VARIANT: Record<
  ButtonVariant,
  'primary' | 'secondary' | 'ghost' | 'destructive'
> = {
  primary: 'primary',
  brand: 'primary',
  subtle: 'secondary',
  danger: 'destructive',
  dangerSubtle: 'ghost',
};

export function Button({
  variant = 'primary',
  small = false,
  type = 'button',
  disabled = false,
  onClick,
  href,
  children,
}: {
  variant?: ButtonVariant;
  small?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  children: string;
}) {
  return (
    <AstryxButton
      label={children}
      variant={VARIANT[variant]}
      size={small ? 'sm' : 'md'}
      type={type}
      isDisabled={disabled}
      onClick={onClick}
      href={href}
    />
  );
}

export function TextInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  disabled = false,
  autoComplete,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: React.InputHTMLAttributes<HTMLInputElement>['autoComplete'];
}) {
  return (
    <AstryxTextInput
      label={label}
      description={description}
      value={value}
      onChange={(_value, e) => onChange(e)}
      placeholder={placeholder}
      isDisabled={disabled}
      autoComplete={autoComplete}
    />
  );
}

export function Select({
  label,
  description,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <Selector
      label={label}
      description={description}
      value={value}
      onChange={onChange}
      options={options}
      isDisabled={disabled}
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <Banner status="error" title={children} />;
}

export function InfoNote({ children }: { children: ReactNode }) {
  return <Banner status="info" title={children} />;
}

const queryError = stylex.create({
  row: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 },
});

/** Query failure banner; a stale Discord grant (409) gets a Reconnect button. */
export function QueryError({ error }: { error: unknown }) {
  if (!(error instanceof ApiError && error.isReconnectRequired)) {
    return <ErrorNote>{apiMessage(error)}</ErrorNote>;
  }
  return (
    <div>
      <ErrorNote>Server data needs a fresh Discord login.</ErrorNote>
      <div {...stylex.props(queryError.row)}>
        <Button onClick={() => void (window.location.href = loginUrl)}>Reconnect Discord</Button>
      </div>
    </div>
  );
}

export function Badge({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <AstryxBadge label={children} variant={strong ? 'info' : 'neutral'} />
  );
}

export function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <AstryxStatusDot variant={on ? 'success' : 'neutral'} label={label} />
  );
}

export function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: Array<{ value: string; label: string }>;
}) {
  return (
    <TabList value={value} onChange={onChange} hasDivider>
      {tabs.map((t) => (
        <Tab key={t.value} value={t.value} label={t.label} />
      ))}
    </TabList>
  );
}

/** Standard page heading: Astryx H1 + secondary supporting line. See DESIGN_STANDARD §3. */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <Heading level={1}>{title}</Heading>
      {description ? (
        <div style={{ marginTop: 6 }}>
          <Text type="supporting" color="secondary">
            {description}
          </Text>
        </div>
      ) : null}
    </div>
  );
}

/** Standard section: Astryx Card with H3 title. Replaces per-page panel styles. */
export function SectionCard({
  title,
  children,
  variant,
}: {
  title: string;
  children: ReactNode;
  variant?: 'default' | 'muted';
}) {
  return (
    <Card variant={variant ?? 'default'} padding={4}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Heading level={3}>{title}</Heading>
        <div>{children}</div>
      </div>
    </Card>
  );
}

/** Standard empty state inside a Card. Replaces per-page empty divs. */
export function EmptyList({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card padding={4}>
      <EmptyState title={title} description={body} actions={action} />
    </Card>
  );
}

/** Standard back link. Single source for ← Dashboard / ← Back chrome. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <RouterLink
      to={to}
      style={{ fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
    >
      {label}
    </RouterLink>
  );
}
