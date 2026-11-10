import { cn } from "../lib/utils";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="/"
      className="group inline-flex items-center gap-3"
      aria-label="MOMENT home"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-card transition duration-300 group-hover:rotate-6">
        <span className="font-display text-xl leading-none">M</span>
      </span>
      <span className={cn("flex flex-col", compact && "hidden sm:flex")}>
        <span className="font-display text-[1.65rem] leading-none tracking-[-0.03em]">
          MOMENT
        </span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.32em] text-muted">
          모먼트 · Photo Studio
        </span>
      </span>
    </a>
  );
}

export function StepMarker({
  step,
  label,
  active = false,
}: {
  step: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold transition",
          active
            ? "border-ink bg-ink text-paper"
            : "border-ink/15 bg-paper/50 text-muted",
        )}
      >
        {step}
      </span>
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.2em]",
          active ? "text-ink" : "text-muted",
        )}
      >
        {label}
      </span>
    </div>
  );
}
