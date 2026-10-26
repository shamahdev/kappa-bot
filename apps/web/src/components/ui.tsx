import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Selector } from "@astryxdesign/core/Selector";
import { StatusDot as AstryxStatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput as AstryxTextInput } from "@astryxdesign/core/TextInput";
import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ChangeEventHandler, MouseEventHandler, ReactNode } from "react";

import { loginUrl } from "../lib/api";
import { ApiError, apiMessage } from "../lib/queries";

type ButtonVariant = "primary" | "brand" | "subtle" | "danger" | "dangerSubtle";

const VARIANT: Record<
  ButtonVariant,
  "primary" | "secondary" | "ghost" | "destructive"
> = {
  primary: "primary",
  brand: "primary",
  subtle: "secondary",
  danger: "destructive",
  dangerSubtle: "ghost",
};

export const Button = ({
  variant = "primary",
  small = false,
  type = "button",
  disabled = false,
  onClick,
  href,
  children,
}: {
  variant?: ButtonVariant;
  small?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  children: string;
}) => (
  <AstryxButton
    href={href}
    isDisabled={disabled}
    label={children}
    onClick={onClick}
    size={small ? "sm" : "md"}
    type={type}
    variant={VARIANT[variant]}
  />
);

export const TextInput = ({
  label,
  description,
  value,
  onChange,
  placeholder,
  disabled = false,
  autoComplete,
  error,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: React.InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  error?: string;
}) => (
  <AstryxTextInput
    autoComplete={autoComplete}
    description={description}
    isDisabled={disabled}
    label={label}
    onChange={(_value, e) => onChange(e)}
    placeholder={placeholder}
    status={error ? { type: "error", message: error } : undefined}
    value={value}
  />
);

export const Select = ({
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
  options: (string | { value: string; label: string })[];
  disabled?: boolean;
}) => (
  <Selector
    description={description}
    isDisabled={disabled}
    label={label}
    onChange={onChange}
    options={options}
    value={value}
  />
);

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <Banner status="error" title={children} />
);

export const InfoNote = ({ children }: { children: ReactNode }) => (
  <Banner status="info" title={children} />
);

const queryError = stylex.create({
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
  },
});

/** Query failure banner; a stale Discord grant (409) gets a Reconnect button. */
export const QueryError = ({ error }: { error: unknown }) => {
  if (!(error instanceof ApiError && error.isReconnectRequired)) {
    return <ErrorNote>{apiMessage(error)}</ErrorNote>;
  }
  return (
    <div>
      <ErrorNote>Server data needs a fresh Discord login.</ErrorNote>
      <div {...stylex.props(queryError.row)}>
        <Button
          onClick={() => {
            window.location.href = loginUrl;
          }}
        >
          Reconnect Discord
        </Button>
      </div>
    </div>
  );
};

export const Badge = ({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) => <AstryxBadge label={children} variant={strong ? "info" : "neutral"} />;

export const StatusDot = ({ on, label }: { on: boolean; label: string }) => (
  <AstryxStatusDot label={label} variant={on ? "success" : "neutral"} />
);

export const Tabs = ({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: { value: string; label: string }[];
}) => (
  <TabList hasDivider onChange={onChange} value={value}>
    {tabs.map((t) => (
      <Tab key={t.value} label={t.label} value={t.value} />
    ))}
  </TabList>
);

/** Standard page heading: Astryx H1 + secondary supporting line. */
export const PageHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div>
    <Heading level={1}>{title}</Heading>
    {description ? (
      <div style={{ marginTop: 6 }}>
        <Text color="secondary" type="supporting">
          {description}
        </Text>
      </div>
    ) : null}
  </div>
);

/** Standard section: Astryx Card with H3 title. Replaces per-page panel styles. */
export const SectionCard = ({
  title,
  children,
  variant,
}: {
  title: string;
  children: ReactNode;
  variant?: "default" | "muted";
}) => (
  <Card padding={4} variant={variant ?? "default"}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Heading level={3}>{title}</Heading>
      <div>{children}</div>
    </div>
  </Card>
);

/** Standard empty state inside a Card. Replaces per-page empty divs. */
export const EmptyList = ({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) => (
  <Card padding={4}>
    <EmptyState actions={action} description={body} title={title} />
  </Card>
);

/** Standard back link. Single source for ← Dashboard / ← Back chrome. */
export const BackLink = ({ to, label }: { to: string; label: string }) => (
  <RouterLink
    style={{
      fontSize: 13,
      color: "var(--color-text-secondary)",
      textDecoration: "none",
    }}
    to={to}
  >
    {label}
  </RouterLink>
);
