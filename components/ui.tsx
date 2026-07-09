import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "red" | "gold" | "primary";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    default: { bg: "var(--surface-2)", fg: "var(--text-2)" },
    green: { bg: "var(--green-soft)", fg: "var(--green)" },
    red: { bg: "var(--red-soft)", fg: "var(--red)" },
    gold: { bg: "var(--gold-soft)", fg: "var(--gold)" },
    primary: { bg: "var(--primary-soft)", fg: "var(--primary)" },
  };
  const t = tones[tone];
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: t.bg, color: t.fg }}
        >
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight">{value}</div>
      {hint && (
        <div className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <Icon size={26} strokeWidth={2} />
      </span>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      {text && (
        <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--text-2)" }}>
          {text}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  inquiry: { label: "მოთხოვნა", bg: "var(--blue-soft)", fg: "var(--blue)" },
  tentative: { label: "წინასწარი", bg: "var(--amber-soft)", fg: "var(--amber)" },
  confirmed: { label: "დადასტურებული", bg: "var(--green-soft)", fg: "var(--green)" },
  completed: { label: "ჩატარებული", bg: "var(--primary-soft)", fg: "var(--primary)" },
  cancelled: { label: "გაუქმებული", bg: "var(--red-soft)", fg: "var(--red)" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    bg: "var(--surface-2)",
    fg: "var(--text-2)",
  };
  return (
    <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: "ქორწილი",
  birthday: "დაბადების დღე",
  corporate: "კორპორატივი",
  anniversary: "იუბილე",
  memorial: "ქელეხი",
  other: "სხვა",
};
