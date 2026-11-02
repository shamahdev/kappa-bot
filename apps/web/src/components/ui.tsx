import { Link } from "@tanstack/react-router";
import { useId } from "react";
import type {
  CSSProperties,
  ChangeEventHandler,
  ElementType,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";

import discordSymbol from "../assets/brands/discord-symbol-white.svg";
import { loginUrl } from "../lib/api";
import { ApiError, apiMessage } from "../lib/queries";
import { Badge as ShadcnBadge } from "./shadcn/badge";
import { Button as ShadcnButton } from "./shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./shadcn/dialog";
import { Input } from "./shadcn/input";
import { Label } from "./shadcn/label";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./shadcn/select";
import {
  Tabs as ShadcnTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./shadcn/tabs";
import { Textarea } from "./shadcn/textarea";

type LayoutProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  gap?: number;
  width?: string | number;
  maxWidth?: string | number;
  wrap?: "wrap" | "nowrap";
  vAlign?: "center" | "start" | "end";
};

const alignments = { start: "flex-start", end: "flex-end", center: "center" };

const Layout = ({
  as: Component = "div",
  gap = 4,
  width,
  maxWidth,
  wrap,
  vAlign,
  className = "",
  style,
  row,
  ...props
}: LayoutProps & { row?: boolean }) => (
  <Component
    {...props}
    className={`${row ? "app-row" : "app-stack"} ${className}`}
    style={
      {
        "--layout-gap": `calc(var(--space-2xs) * ${gap})`,
        width,
        maxWidth,
        flexWrap: wrap,
        alignItems: vAlign ? alignments[vAlign] : undefined,
        ...style,
      } as CSSProperties
    }
  />
);
export const VStack = (props: LayoutProps) => <Layout {...props} />;
export const HStack = (props: LayoutProps) => <Layout {...props} row />;

export const Text = ({
  as: Component = "span",
  color = "primary",
  type,
  weight,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  color?: string;
  type?: string;
  weight?: string;
}) => (
  <Component
    {...props}
    className={`app-text ${color === "secondary" ? "app-muted" : ""} ${type === "supporting" || type === "label" ? "app-small" : ""} ${type === "code" ? "app-code" : ""} ${weight ? "app-emphasis" : ""} ${className}`}
  />
);

// App-facing primitives keep their props; all are built on shadcn components.
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
  variant?: "primary" | "brand" | "subtle" | "danger" | "dangerSubtle";
  small?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  children: ReactNode;
}) => {
  const look = {
    size: small ? ("sm" as const) : ("default" as const),
    variant:
      variant === "primary" || variant === "brand"
        ? ("default" as const)
        : variant,
  };
  if (href) {
    return (
      <ShadcnButton asChild {...look}>
        <a
          aria-busy={loading || undefined}
          aria-disabled={disabled || undefined}
          href={disabled ? undefined : href}
        >
          {children}
        </a>
      </ShadcnButton>
    );
  }
  return (
    <ShadcnButton
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={onClick}
      type={type === "submit" ? "submit" : "button"}
      {...look}
    >
      {children}
    </ShadcnButton>
  );
};

export const DiscordLogin = ({
  label = "Log in with Discord",
  small = false,
}: {
  label?: string;
  small?: boolean;
}) => (
  <ShadcnButton asChild size={small ? "sm" : "default"} variant="discord">
    <a href={loginUrl}>
      <img
        alt=""
        aria-hidden="true"
        height="19"
        src={discordSymbol}
        width="25"
      />
      {label}
    </a>
  </ShadcnButton>
);

const FieldHelp = ({
  id,
  text,
  error = false,
}: {
  id: string;
  text?: string;
  error?: boolean;
}) =>
  text ? (
    <p className={`app-field-help ${error ? "app-error-text" : ""}`} id={id}>
      {text}
    </p>
  ) : null;

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
}) => {
  const id = useId();
  return (
    <div className="app-field">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={description || error ? `${id}-help` : undefined}
        aria-invalid={Boolean(error) || undefined}
        autoComplete={autoComplete}
        disabled={disabled}
        id={id}
        name={label.toLowerCase().replaceAll(" ", "-")}
        onChange={onChange}
        placeholder={placeholder}
        value={value}
      />
      <FieldHelp
        error={Boolean(error)}
        id={`${id}-help`}
        text={error || description}
      />
    </div>
  );
};

// Radix Select reserves "" for "no value"; app options may use "" (e.g. "All").
const EMPTY_OPTION = "__kappa_empty__";
const toItem = (value: string) => (value === "" ? EMPTY_OPTION : value);
const fromItem = (value: string) => (value === EMPTY_OPTION ? "" : value);

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
}) => {
  const id = useId();
  const items = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option
  );
  return (
    <div className="app-field">
      <Label htmlFor={id}>{label}</Label>
      <ShadcnSelect
        disabled={disabled}
        onValueChange={(next) => onChange(fromItem(next))}
        value={toItem(value)}
      >
        <SelectTrigger
          aria-describedby={description ? `${id}-help` : undefined}
          id={id}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={toItem(item.value)}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
      <FieldHelp id={`${id}-help`} text={description} />
    </div>
  );
};

export const TextArea = ({
  label,
  description,
  value,
  onChange,
  disabled = false,
  placeholder,
  error,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
}) => {
  const id = useId();
  return (
    <div className="app-field">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        aria-describedby={description || error ? `${id}-help` : undefined}
        aria-invalid={Boolean(error) || undefined}
        disabled={disabled}
        id={id}
        name="cv"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <FieldHelp
        error={Boolean(error)}
        id={`${id}-help`}
        text={error || description}
      />
    </div>
  );
};

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <div className="app-note app-note-error" role="alert">
    {children}
  </div>
);
export const InfoNote = ({ children }: { children: ReactNode }) => (
  <div className="app-note">{children}</div>
);
export const QueryError = ({ error }: { error: unknown }) =>
  error instanceof ApiError && error.isReconnectRequired ? (
    <VStack gap={3}>
      <ErrorNote>Server data needs a fresh Discord login.</ErrorNote>
      <HStack>
        <DiscordLogin label="Reconnect Discord" />
      </HStack>
    </VStack>
  ) : (
    <ErrorNote>{apiMessage(error)}</ErrorNote>
  );
export const LoadingNote = ({
  children = "Loading…",
}: {
  children?: string;
}) => <output className="app-muted">{children}</output>;
export const Badge = ({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) => (
  <ShadcnBadge variant={strong ? "strong" : "default"}>{children}</ShadcnBadge>
);
export const StatusDot = ({ on, label }: { on: boolean; label: string }) => (
  <ShadcnBadge className="app-status" variant={on ? "strong" : "default"}>
    {label}
  </ShadcnBadge>
);

export const Tabs = ({
  value,
  onChange,
  tabs,
  label = "Page views",
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: { value: string; label: string; content: ReactNode }[];
  label?: string;
}) => (
  <ShadcnTabs className="app-stack" onValueChange={onChange} value={value}>
    <TabsList aria-label={label}>
      {tabs.map((tab) => (
        <TabsTrigger key={tab.value} value={tab.value}>
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {tabs.map((tab) => (
      <TabsContent key={tab.value} value={tab.value}>
        {tab.content}
      </TabsContent>
    ))}
  </ShadcnTabs>
);

export const PageHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <header className="app-page-header">
    <h1>{title}</h1>
    {description ? <p>{description}</p> : null}
  </header>
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
  <section className={`app-section ${variant === "muted" ? "muted" : ""}`}>
    <h2>{title}</h2>
    <div>{children}</div>
  </section>
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
  <div className="app-empty">
    <h2>{title}</h2>
    <p>{body}</p>
    {action ? <div>{action}</div> : null}
  </div>
);
export const BackLink = ({ to, label }: { to: string; label: string }) => (
  <Link className="app-back" to={to}>
    {label}
  </Link>
);
export const Avatar = ({
  name,
  src,
  size = "lg",
}: {
  name: string;
  src?: string;
  size?: string;
}) => (
  <span className={`app-avatar ${size}`} aria-hidden="true">
    {src ? (
      <img alt="" height={48} src={src} width={48} />
    ) : (
      name.slice(0, 1).toUpperCase()
    )}
  </span>
);

export const Modal = ({
  open,
  onClose,
  title,
  children,
  showCloseButton = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
}) => (
  <Dialog
    onOpenChange={(next) => {
      if (!next) {
        onClose();
      }
    }}
    open={open}
  >
    <DialogContent showCloseButton={showCloseButton}>
      <header className="app-modal-header">
        <DialogTitle>{title}</DialogTitle>
      </header>
      {/* Radix requires a description slot; the body itself describes. */}
      <DialogDescription asChild>
        <div>{children}</div>
      </DialogDescription>
    </DialogContent>
  </Dialog>
);
