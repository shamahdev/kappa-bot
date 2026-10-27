import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import { StatusDot as AstryxStatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput as AstryxTextInput } from "@astryxdesign/core/TextInput";
import { useId } from "react";
import type { ChangeEventHandler, MouseEventHandler, ReactNode } from "react";

import { loginUrl } from "../lib/api";
import { ApiError, apiMessage } from "../lib/queries";

type ButtonVariant = "primary" | "brand" | "subtle" | "danger" | "dangerSubtle";
const VARIANT: Record<ButtonVariant, "primary" | "secondary" | "destructive"> =
  {
    primary: "primary",
    brand: "primary",
    subtle: "secondary",
    danger: "destructive",
    dangerSubtle: "destructive",
  };

export const Button = ({
  variant = "primary",
  small = false,
  type = "button",
  disabled = false,
  loading = false,
  onClick,
  href,
  children,
}: {
  variant?: ButtonVariant;
  small?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  children: string;
}) => (
  <AstryxButton
    href={href}
    isDisabled={disabled && !loading}
    isLoading={loading}
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
    onChange={(_value, event) => onChange(event)}
    placeholder={placeholder}
    status={error ? { type: "error", message: error } : undefined}
    value={value}
    width="100%"
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
    presentation="adaptive"
    value={value}
    width="100%"
  />
);

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <Banner status="error" title={children} />
);
export const InfoNote = ({ children }: { children: ReactNode }) => (
  <Banner status="info" title={children} />
);

export const QueryError = ({ error }: { error: unknown }) => {
  if (!(error instanceof ApiError && error.isReconnectRequired)) {
    return <ErrorNote>{apiMessage(error)}</ErrorNote>;
  }
  return (
    <VStack gap={3}>
      <ErrorNote>Server data needs a fresh Discord login.</ErrorNote>
      <HStack>
        <Button href={loginUrl}>Reconnect Discord</Button>
      </HStack>
    </VStack>
  );
};

export const LoadingNote = ({
  children = "Loading…",
}: {
  children?: string;
}) => (
  <output>
    <Text color="secondary">{children}</Text>
  </output>
);

export const Badge = ({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) => <AstryxBadge label={children} variant={strong ? "info" : "neutral"} />;

export const StatusDot = ({ on, label }: { on: boolean; label: string }) => (
  <HStack gap={2} vAlign="center" wrap="wrap">
    <AstryxStatusDot label={label} variant={on ? "success" : "neutral"} />
    <Text type="supporting">{label}</Text>
  </HStack>
);

/** Local view tabs own their associated panels and keyboard/ARIA semantics. */
export const Tabs = ({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: { value: string; label: string; content: ReactNode }[];
}) => {
  const id = useId();
  return (
    <VStack gap={4}>
      <TabList
        aria-label="Page views"
        hasDivider
        onChange={onChange}
        role="tablist"
        value={value}
      >
        {tabs.map((tab) => (
          <Tab
            id={`${id}-${tab.value}-tab`}
            key={tab.value}
            label={tab.label}
            panelId={`${id}-${tab.value}-panel`}
            value={tab.value}
          />
        ))}
      </TabList>
      {tabs.map((tab) => (
        <div
          aria-labelledby={`${id}-${tab.value}-tab`}
          hidden={value !== tab.value}
          id={`${id}-${tab.value}-panel`}
          key={tab.value}
          role="tabpanel"
        >
          {value === tab.value ? tab.content : null}
        </div>
      ))}
    </VStack>
  );
};

export const PageHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <VStack gap={2}>
    <Heading level={1}>{title}</Heading>
    {description ? (
      <Text color="secondary" type="supporting">
        {description}
      </Text>
    ) : null}
  </VStack>
);

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
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      <div>{children}</div>
    </VStack>
  </Card>
);

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

export const BackLink = ({ to, label }: { to: string; label: string }) => (
  <Link color="secondary" href={to} type="supporting">
    {label}
  </Link>
);
