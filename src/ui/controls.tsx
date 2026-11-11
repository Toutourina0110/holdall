import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./controls.module.css";

type Variant = "primary" | "quiet" | "danger" | "icon";

function buttonClass(variant: Variant, extra?: string) {
  return [styles.button, styles[variant], extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "quiet",
  icon,
  shortcut,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; shortcut?: string }) {
  return (
    <button className={buttonClass(variant, className)} type={rest.type ?? "button"} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  );
}

export function IconButton({ icon, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button className={buttonClass("icon")} type={rest.type ?? "button"} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function ButtonLink({ href, variant = "quiet", icon, label, children }: { href: string; variant?: Variant; icon?: IconName; label?: string; children?: ReactNode }) {
  return (
    <Link className={buttonClass(variant)} href={href} aria-label={label} title={label}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

export function Chip({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <span className={styles.chip}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export function Tile({ icon }: { icon: IconName }) {
  return (
    <span className={styles.tile}>
      <Icon name={icon} />
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  multiline,
  ...input
}: InputHTMLAttributes<HTMLInputElement> &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string; multiline?: boolean; name: string }) {
  const id = input.id ?? `field-${input.name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...(input as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className={styles.input}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...(input as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {hint && (
        <span className={styles.hint} id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className={styles.error} id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  return (
    <div className={styles.notice} data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      {tone === "error" || tone === "warn" ? <Icon name="alert" /> : null}
      <span>{children}</span>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segment}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
