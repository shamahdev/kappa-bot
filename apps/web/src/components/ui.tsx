import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef } from "react";
import type {
  CSSProperties,
  ChangeEventHandler,
  ElementType,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";

import { loginUrl } from "../lib/api";
import { ApiError, apiMessage } from "../lib/queries";

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
  children: string;
}) => {
  const className = `app-button ${variant === "brand" ? "primary" : variant} ${small ? "compact" : ""}`;
  if (href) {
    return (
      <a
        aria-busy={loading || undefined}
        aria-disabled={disabled || undefined}
        className={className}
        href={disabled ? undefined : href}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      aria-busy={loading || undefined}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      type={type === "submit" ? "submit" : "button"}
    >
      {children}
    </button>
  );
};

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
      <label htmlFor={id}>{label}</label>
      <input
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
      {description || error ? (
        <p
          className={`app-field-help ${error ? "app-error-text" : ""}`}
          id={`${id}-help`}
        >
          {error || description}
        </p>
      ) : null}
    </div>
  );
};

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
  return (
    <div className="app-field">
      <label htmlFor={id}>{label}</label>
      <select
        aria-describedby={description ? `${id}-help` : undefined}
        disabled={disabled}
        id={id}
        name={label.toLowerCase()}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
      {description ? (
        <p className="app-field-help" id={`${id}-help`}>
          {description}
        </p>
      ) : null}
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
      <label htmlFor={id}>{label}</label>
      <textarea
        aria-describedby={description || error ? `${id}-help` : undefined}
        aria-invalid={Boolean(error) || undefined}
        disabled={disabled}
        id={id}
        name="cv"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {description || error ? (
        <p
          className={`app-field-help ${error ? "app-error-text" : ""}`}
          id={`${id}-help`}
        >
          {error || description}
        </p>
      ) : null}
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
        <Button href={loginUrl}>Reconnect Discord</Button>
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
}) => <span className={`app-badge ${strong ? "strong" : ""}`}>{children}</span>;
export const StatusDot = ({ on, label }: { on: boolean; label: string }) => (
  <span className={`app-status ${on ? "active" : ""}`}>{label}</span>
);

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
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <VStack gap={4}>
      <div aria-label="Page views" className="app-tabs" role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${id}-${tab.value}-panel`}
            aria-selected={value === tab.value}
            id={`${id}-${tab.value}-tab`}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => {
              let next: number | undefined;
              if (event.key === "ArrowRight") {
                next = (index + 1) % tabs.length;
              }
              if (event.key === "ArrowLeft") {
                next = (index - 1 + tabs.length) % tabs.length;
              }
              if (event.key === "Home") {
                next = 0;
              }
              if (event.key === "End") {
                next = tabs.length - 1;
              }
              if (next !== undefined) {
                event.preventDefault();
                onChange(tabs[next].value);
                buttons.current[next]?.focus();
              }
            }}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            role="tab"
            tabIndex={value === tab.value ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target !== element) {
        return;
      }
      const bounds = element.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        onClose();
      }
    };
    element.addEventListener("click", closeOnBackdrop);
    return () => element.removeEventListener("click", closeOnBackdrop);
  }, [open, onClose]);
  return (
    <dialog
      aria-labelledby={id}
      className="app-modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialog}
    >
      <header className="app-modal-header">
        <h2 id={id}>{title}</h2>
        <button
          aria-label="Close dialog"
          className="app-button subtle compact"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </header>
      {open ? children : null}
    </dialog>
  );
};
