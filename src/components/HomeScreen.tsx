import {
  ArrowRight,
  Camera,
  Heart,
  Lock,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import type { FrameId, LayoutId } from "../../shared/contracts";
import {
  FRAME_LABELS,
  LAYOUT_KOREAN_LABELS,
  LAYOUT_LABELS,
  LAYOUT_IDS,
  TIMER_OPTIONS,
} from "../../shared/contracts";
import { FRAME_THEMES, themeFor } from "../lib/themes";
import { cn } from "../lib/utils";
import type { BoothConfig } from "../types";
import { Wordmark } from "./Brand";

interface HomeScreenProps {
  config: BoothConfig;
  onConfigChange: (config: BoothConfig) => void;
  onStart: () => void;
}

function LayoutGlyph({ layout }: { layout: LayoutId }) {
  if (layout === "classic") {
    return (
      <div className="flex h-14 w-9 flex-col gap-1 rounded-[3px] bg-current p-1 opacity-80">
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="flex-1 rounded-[1px] bg-paper/90" />
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid h-14 w-14 grid-cols-2 gap-1 rounded-[3px] bg-current p-1 opacity-80">
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="rounded-[1px] bg-paper/90" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-14 w-20 items-center justify-center rounded-[3px] bg-current p-1 opacity-80">
      <span className="h-full w-full rounded-[1px] bg-paper/90" />
    </div>
  );
}

function SampleStrip({
  className,
  themeId = "cream",
  accent = "🐰",
  title = "MOMENT",
}: {
  className?: string;
  themeId?: FrameId;
  accent?: string;
  title?: string;
}) {
  const theme = themeFor(themeId);
  const isNoir = theme.dark;

  return (
    <div
      className={cn(
        "w-[188px] rounded-[16px] p-3 shadow-strip ring-1 ring-black/5 sm:w-[210px]",
        className,
      )}
      style={{ background: theme.cssBackground, color: theme.ink }}
    >
      <div className="mb-2.5 text-center">
        <p className="font-display text-[1.15rem] leading-none tracking-[-0.02em]">
          {title}
        </p>
        <p
          className="mt-1 text-[6px] font-medium uppercase tracking-[0.26em]"
          style={{ color: theme.softInk }}
        >
          Korean photo booth
        </p>
      </div>
      <div className="space-y-1.5">
        {[
          "linear-gradient(145deg, #E8C7BF 0%, #B7CFD5 100%)",
          "linear-gradient(155deg, #D8C9E8 0%, #F2D9BE 100%)",
          "linear-gradient(145deg, #C9D9C2 0%, #E9D3CB 100%)",
          "linear-gradient(145deg, #E9D7B7 0%, #C4C9DE 100%)",
        ].map((background, index) => (
          <div
            key={background}
            className="relative aspect-[3/2] overflow-hidden rounded-[3px]"
            style={{ background }}
          >
            <span className="absolute inset-0 grain-overlay opacity-30 mix-blend-soft-light" />
            <span
              className={cn(
                "absolute text-[1.35rem] drop-shadow-sm",
                index === 0 && "-right-1 top-1 rotate-12",
                index === 1 && "left-2 bottom-1 -rotate-12",
                index === 2 && "right-3 bottom-2 rotate-6",
                index === 3 && "left-1 top-1 -rotate-6",
              )}
            >
              {index === 0 ? accent : index === 1 ? "✨" : index === 2 ? "🎀" : "♡"}
            </span>
            {index === 0 && (
              <span className="absolute left-1/2 top-1/2 h-10 w-7 -translate-x-1/2 -translate-y-1/2 rounded-t-full bg-black/10 blur-[1px]" />
            )}
          </div>
        ))}
      </div>
      <div
        className="mt-2.5 flex items-center justify-between border-t pt-2 text-[6px] font-medium uppercase tracking-[0.18em]"
        style={{ borderColor: theme.line, color: theme.softInk }}
      >
        <span>Seoul · 26</span>
        <span>4 cut</span>
      </div>
      <span
        className={cn(
          "absolute -right-3 top-8 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-widest shadow-sm",
          isNoir ? "border-white/20 bg-white text-ink" : "border-black/10 bg-ink text-paper",
        )}
      >
        {themeId === "noir" ? "Mono" : "Glow"}
      </span>
    </div>
  );
}

function LayoutOption({
  layout,
  selected,
  onClick,
}: {
  layout: LayoutId;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex min-h-[150px] flex-col items-center justify-center gap-4 rounded-[1.35rem] border p-4 text-center transition duration-300",
        selected
          ? "border-ink bg-ink text-paper shadow-card"
          : "border-ink/10 bg-white/40 text-ink hover:-translate-y-0.5 hover:border-ink/25 hover:bg-white/70",
      )}
    >
      <div className={cn("transition group-hover:scale-105", selected ? "text-paper" : "text-ink")}>
        <LayoutGlyph layout={layout} />
      </div>
      <div>
        <p className="text-sm font-medium">{LAYOUT_LABELS[layout]}</p>
        <p
          className={cn(
            "mt-1 text-[11px]",
            selected ? "text-paper/55" : "text-muted",
          )}
        >
          {LAYOUT_KOREAN_LABELS[layout]}
        </p>
      </div>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked ? "border-ink bg-ink" : "border-ink/15 bg-ink/10",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-paper shadow-sm transition",
            checked ? "left-6" : "left-1",
          )}
        />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}

export function HomeScreen({ config, onConfigChange, onStart }: HomeScreenProps) {
  const update = (patch: Partial<BoothConfig>) => {
    onConfigChange({ ...config, ...patch });
  };

  const scrollToBooth = () => {
    document.getElementById("booth")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[52rem] overflow-hidden">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-blush/50 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-sage/40 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-butter/30 blur-3xl" />
      </div>

      <header className="relative z-50 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-xs font-medium text-muted md:flex">
          <a className="transition hover:text-ink" href="#booth">
            The booth
          </a>
          <a className="transition hover:text-ink" href="#how-it-works">
            How it works
          </a>
          <a className="transition hover:text-ink" href="#privacy">
            Privacy
          </a>
        </nav>
        <button type="button" onClick={scrollToBooth} className="btn-secondary !px-5 !py-2.5">
          <span className="hidden sm:inline">Start a strip</span>
          <span className="sm:hidden">Start</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:px-10 lg:pb-28 lg:pt-16">
          <div className="animate-fade-up">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted backdrop-blur">
              <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-rose" />
              Seoul, in your browser
            </div>

            <h1 className="max-w-[11ch] font-display text-[clamp(4rem,8.4vw,7.7rem)] leading-[0.84] tracking-[-0.045em] text-ink">
              Your little
              <span className="block italic text-rose">moment</span>
              to keep.
            </h1>

            <p className="mt-8 max-w-md text-balance text-base leading-7 text-muted sm:text-lg">
              A soft-lit Korean photo booth for four cuts, silly stickers, and
              the kind of day you want to remember. No app. No account. Just
              you and your camera.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={scrollToBooth} className="btn-primary !px-7 !py-4">
                Step into the booth
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#how-it-works" className="btn-secondary !px-7 !py-4">
                See how it works
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-rose" />
                K-studio glow
              </span>
              <span className="inline-flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-rose" />
                Sticker lab
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-sage" />
                Private by design
              </span>
            </div>
          </div>

          <div className="relative isolate flex min-h-[420px] items-center justify-center lg:min-h-[570px]">
            <div className="absolute h-[340px] w-[340px] rounded-full border border-ink/10 sm:h-[420px] sm:w-[420px]" />
            <div className="absolute h-[270px] w-[270px] rounded-full border border-dashed border-ink/10 sm:h-[340px] sm:w-[340px]" />
            <span className="absolute left-[7%] top-[13%] animate-soft-pulse font-display text-3xl text-rose">
              ✦
            </span>
            <span className="absolute bottom-[18%] right-[8%] font-display text-2xl text-ink/40">
              ♡
            </span>
            <SampleStrip
              themeId="sky"
              accent="🌸"
              className="absolute left-1/2 top-1/2 z-10 -translate-x-[82%] -translate-y-[10%] rotate-[-13deg] scale-[0.82] opacity-90 sm:scale-90"
            />
            <SampleStrip
              themeId="cream"
              accent="🐰"
              className="relative z-20 rotate-[5deg]"
            />
            <SampleStrip
              themeId="noir"
              accent="💋"
              title="MOMENT"
              className="absolute left-1/2 top-1/2 z-30 translate-x-[8%] translate-y-[14%] rotate-[16deg] scale-[0.72] sm:scale-[0.8]"
            />

            <div className="absolute bottom-1 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ink/10 bg-paper/90 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted shadow-card backdrop-blur">
              <Camera className="h-3 w-3" />
              Live camera · local capture
            </div>
          </div>
        </section>

        <section id="booth" className="mx-auto w-full max-w-7xl scroll-mt-6 px-5 pb-24 sm:px-8 lg:px-10">
          <div className="panel overflow-hidden">
            <div className="grid gap-10 p-6 sm:p-9 lg:grid-cols-[0.68fr_1.32fr] lg:gap-12 lg:p-12">
              <div className="flex flex-col justify-between gap-8">
                <div>
                  <p className="eyebrow">Build your cut</p>
                  <h2 className="mt-4 max-w-xs font-display text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
                    Set the mood, then say cheese.
                  </h2>
                  <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
                    Choose your frame, pace, and little paper details. You can
                    restyle the photos and add stickers before anything leaves
                    your device.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white/40 p-4">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                    <p className="text-xs leading-5 text-muted">
                      Camera frames stay in your browser while you shoot.
                      Uploads only happen when you develop your strip.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <Timer className="h-4 w-4" />
                    Camera permission required
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <p className="text-sm font-medium">Choose a layout</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      Step 01
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {LAYOUT_IDS.map((layout) => (
                      <LayoutOption
                        key={layout}
                        layout={layout}
                        selected={config.layout === layout}
                        onClick={() => update({ layout })}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div>
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <p className="text-sm font-medium">Countdown</p>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Step 02
                      </span>
                    </div>
                    <div className="flex rounded-full border border-ink/10 bg-white/45 p-1">
                      {TIMER_OPTIONS.map((seconds) => (
                        <button
                          key={seconds}
                          type="button"
                          onClick={() => update({ timer: seconds })}
                          className={cn(
                            "flex-1 rounded-full px-3 py-2.5 text-xs font-medium transition",
                            config.timer === seconds
                              ? "bg-ink text-paper shadow-sm"
                              : "text-muted hover:text-ink",
                          )}
                        >
                          {seconds}s
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {config.timer === 3
                        ? "Quick, spontaneous, a little chaotic."
                        : config.timer === 5
                          ? "Enough time to find your light."
                          : "For the full pose-and-pout ritual."}
                    </p>
                  </div>

                  <div>
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <p className="text-sm font-medium">Paper tone</p>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Step 03
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(FRAME_THEMES).map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          title={FRAME_LABELS[theme.id]}
                          aria-label={FRAME_LABELS[theme.id]}
                          aria-pressed={config.frame === theme.id}
                          onClick={() => update({ frame: theme.id })}
                          className={cn(
                            "h-9 w-9 rounded-full border-2 transition duration-300 hover:scale-110",
                            config.frame === theme.id
                              ? "border-ink ring-2 ring-ink/10"
                              : "border-white shadow-sm",
                          )}
                          style={{ background: theme.cssBackground }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {FRAME_LABELS[config.frame]}
                    </p>
                  </div>
                </div>

                <div className="section-divider" />

                <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label htmlFor="caption" className="mb-2 block text-sm font-medium">
                      Little caption
                    </label>
                    <input
                      id="caption"
                      className="input-field"
                      maxLength={40}
                      value={config.caption}
                      placeholder="e.g. seoul, with you"
                      onChange={(event) => update({ caption: event.target.value })}
                    />
                  </div>
                  <div className="sm:w-56">
                    <Toggle
                      checked={config.showDate}
                      onChange={(showDate) => update({ showDate })}
                      label="Date stamp"
                      description="Tiny, minimalist, forever"
                    />
                  </div>
                </div>

                <button type="button" onClick={onStart} className="btn-primary w-full !py-4">
                  <Camera className="h-4 w-4" />
                  Enter the booth
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto w-full max-w-7xl scroll-mt-10 px-5 pb-24 sm:px-8 lg:px-10"
        >
          <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">The ritual</p>
              <h2 className="mt-3 font-display text-4xl tracking-[-0.03em] sm:text-5xl">
                Three little acts.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted">
              Built for the same joy as a real Korean booth — with a little more
              control, and a lot more sparkle.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Shoot",
                text: "A live countdown, automatic frame progression, and a per-frame retake if the cat walks in.",
                icon: Camera,
              },
              {
                number: "02",
                title: "Style",
                text: "Swap film tones, soften the light, and drag tiny hearts and stamps right where they belong.",
                icon: Sparkles,
              },
              {
                number: "03",
                title: "Keep",
                text: "Develop a high-resolution strip, download it, or share it with a private, expiring QR link.",
                icon: Heart,
              },
            ].map((item) => (
              <article
                key={item.number}
                className="group relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-paper/55 p-7 transition duration-300 hover:-translate-y-1 hover:bg-paper/80"
              >
                <span className="font-display text-5xl italic text-ink/15">{item.number}</span>
                <item.icon className="absolute right-7 top-7 h-5 w-5 text-rose" />
                <h3 className="mt-8 font-display text-2xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="privacy"
          className="mx-auto w-full max-w-7xl scroll-mt-10 px-5 pb-24 sm:px-8 lg:px-10"
        >
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-paper sm:px-12 lg:px-16">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full border border-white/10" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-paper/45">
                  Quietly private
                </p>
                <h2 className="mt-4 max-w-md font-display text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
                  Your face is not our business model.
                </h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  ["Local capture", "Webcam frames never leave the browser until you choose to develop."],
                  ["Expiring links", "Share tokens are temporary, unguessable, and never expose a file path."],
                  ["Hardened uploads", "Magic-byte checks, 10MB limits, and non-predictable file names."],
                  ["No account", "No passwords, no social login, no profile to maintain."],
                ].map(([title, text]) => (
                  <div key={title}>
                    <ShieldCheck className="mb-2 h-4 w-4 text-sage" />
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-paper/50">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 border-t border-ink/10 px-5 py-8 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <span>MOMENT · 모먼트 — a tiny photo studio for the internet.</span>
        <span>Made for soft light and better memories.</span>
      </footer>
    </div>
  );
}
