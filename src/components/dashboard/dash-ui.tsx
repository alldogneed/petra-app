/**
 * Dashboard design primitives — the "Petra Dashboard" design (Claude Design, 2026-10).
 *
 * Flat white cards (slate-200 border, 16px radius, hairline shadow), 16px semibold
 * titles with a 13px slate subtitle, an orange text link on the opposite side,
 * and rows separated by a slate-100 hairline. Every widget in widgets/* builds on
 * these so the dashboard reads as one system — don't restyle a widget ad hoc.
 */
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const CARD_SHADOW = "shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)]";

/** Card shell. `flush` = no inner padding (the stats strip draws its own cells). */
export function DashCard({
  children,
  className,
  flush,
}: {
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "bg-white border border-slate-200 rounded-2xl h-full",
        CARD_SHADOW,
        !flush && "px-4 sm:px-6 pt-5 pb-2.5",
        className
      )}
    >
      {children}
    </section>
  );
}

/** Title + optional subtitle on the start side, actions (links/buttons) on the end side. */
export function DashCardHeader({
  title,
  subtitle,
  actions,
  titleExtra,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Rendered right after the title on the same line (e.g. "לדוחות"). */
  titleExtra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap pb-2.5">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-base font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
          {titleExtra}
        </div>
        {subtitle != null && subtitle !== "" && <span className="text-[13px] text-slate-500">{subtitle}</span>}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}

/** Orange text link used in card headers ("לכל ההזמנות", "הצג הכל"…). */
export function DashLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("text-[13px] font-medium text-orange-600 hover:text-orange-700 hover:underline", className)}>
      {children}
    </Link>
  );
}

/** Plain (non-clickable) row with the hairline separator. */
export function DashRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-3 py-[11px] border-t border-slate-100", className)}>{children}</div>;
}

/** Whole-row link with a soft hover background (bleeds 8px past the card padding). */
export function DashLinkRow({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 py-[11px] px-2 -mx-2 border-t border-slate-100 rounded-lg text-slate-900 hover:bg-slate-50 transition-colors",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function DashEmpty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-[18px] border-t border-slate-100 text-sm text-slate-500">{children}</p>;
}

/** Segmented control (הכל / באיחור / להיום, service-type tabs). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: React.ReactNode }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex bg-slate-100 rounded-[10px] p-[3px] gap-0.5 max-w-full overflow-x-auto">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={cn(
              "h-7 px-3 rounded-[7px] text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-slate-500 hover:text-slate-900"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const MINI_BTN =
  "h-[30px] px-3 flex-shrink-0 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-900 inline-flex items-center gap-1.5 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50";

/** Small outlined button ("לטיפול", "משימה", "שלח הכל"). Pass `href` for a link. */
export function MiniButton({
  href,
  onClick,
  children,
  title,
  disabled,
  className,
  external,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
  className?: string;
  external?: boolean;
}) {
  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" title={title} onClick={onClick} className={cn(MINI_BTN, className)}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} title={title} className={cn(MINI_BTN, className)}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className={cn(MINI_BTN, className)}>
      {children}
    </button>
  );
}

/** Green WhatsApp icon button (opens wa.me in a new tab). */
export function WaIconButton({ href, onClick, title = "שלח הודעה בוואטסאפ" }: { href: string; onClick?: () => void; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-[30px] h-[30px] flex-shrink-0 rounded-lg border border-slate-200 bg-white text-green-600 flex items-center justify-center hover:bg-green-50 hover:border-green-200 transition-colors"
    >
      <MessageCircle className="w-[15px] h-[15px]" />
    </a>
  );
}

/** Outlined green text button with the WhatsApp icon ("שלח", "ברכה", "שלח לכולם"). */
export function WaTextButton({
  href,
  onClick,
  children,
  title,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  const cls =
    "h-[30px] px-3 flex-shrink-0 rounded-lg border border-green-200 bg-white text-[13px] font-medium text-green-700 inline-flex items-center gap-1.5 hover:bg-green-50 transition-colors disabled:opacity-50";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} title={title} className={cls}>
        <MessageCircle className="w-3.5 h-3.5" />
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className={cls}>
      <MessageCircle className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

/** "נשלח" confirmation shown in place of a send button. */
export function SentMark({ children = "נשלח" }: { children?: React.ReactNode }) {
  return <span className="text-xs font-medium text-emerald-700 min-w-[30px] text-center flex-shrink-0">{children}</span>;
}

/** Coloured status text with a 6px dot (appointment status). */
export function StatusDot({ label, color, dot }: { label: string; color: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

/** Task checkbox (18px) — turns green on hover, filled while completing. */
export function TaskCheckbox({ onClick, completing }: { onClick: () => void; completing?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={completing}
      title="סמן כבוצע"
      aria-label="סמן כבוצע"
      className={cn(
        "group w-[18px] h-[18px] flex-shrink-0 rounded-[5px] border-[1.5px] flex items-center justify-center transition-all",
        completing
          ? "bg-emerald-500 border-emerald-500 text-white"
          : "border-slate-300 bg-white text-transparent hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500"
      )}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </button>
  );
}

/** Priority dot colours (design PRIORITY map). */
export const PRIORITY_DOT: Record<string, { color: string; label: string }> = {
  URGENT: { color: "#DC2626", label: "דחוף" },
  HIGH: { color: "#EF4444", label: "גבוהה" },
  MEDIUM: { color: "#F59E0B", label: "בינונית" },
  LOW: { color: "#94A3B8", label: "נמוכה" },
};

export function PriorityDot({ priority }: { priority: string }) {
  const p = PRIORITY_DOT[priority] ?? PRIORITY_DOT.LOW;
  return <span title={p.label} className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />;
}
