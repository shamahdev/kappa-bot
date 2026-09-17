import { Badge as AstryxBadge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button as AstryxButton } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot as AstryxStatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { TextInput as AstryxTextInput } from '@astryxdesign/core/TextInput';
import * as stylex from '@stylexjs/stylex';
import type { ChangeEventHandler, MouseEventHandler, ReactNode } from 'react';
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
  children,
}: {
  variant?: ButtonVariant;
  small?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
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
