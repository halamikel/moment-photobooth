import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { CreateShareResponse } from "../../shared/contracts";
import { FRAME_LABELS, LAYOUT_LABELS } from "../../shared/contracts";
import { createShare } from "../lib/api";
import { formatExpiry } from "../lib/utils";
import type { PublishedBooth } from "../types";
import { StepMarker, Wordmark } from "./Brand";
import { QrModal } from "./QrModal";

interface ResultScreenProps {
  published: PublishedBooth;
  onStartOver: () => void;
}

export function ResultScreen({ published, onStartOver }: ResultScreenProps) {
  const [share, setShare] = useState<CreateShareResponse | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const shareUrl = share
    ? new URL(share.path, window.location.origin).toString()
    : "";

  const handleShare = async () => {
    if (share) {
      setQrOpen(true);
      return;
    }

    setShareError(null);
    setIsCreatingShare(true);
    try {
      const created = await createShare(
        published.session.id,
        published.accessToken,
      );
      setShare(created);
      setQrOpen(true);
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "The QR link could not be created.",
      );
    } finally {
      setIsCreatingShare(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Wordmark />
        <div className="hidden items-center gap-8 md:flex">
          <StepMarker step="01" label="Shoot" />
          <span className="h-px w-8 bg-ink/15" />
          <StepMarker step="02" label="Style" />
          <span className="h-px w-8 bg-ink/15" />
          <StepMarker step="03" label="Keep" active />
        </div>
        <button type="button" onClick={onStartOver} className="btn-ghost !px-3">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">New strip</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 sm:px-8 lg:px-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-sage/50 bg-sage/15 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/70">
            <Check className="h-3.5 w-3.5" />
            Developed & stored privately
          </div>
          <h1 className="font-display text-5xl leading-[0.92] tracking-[-0.035em] sm:text-6xl">
            A little moment,
            <span className="italic text-rose"> kept.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted">
            Your high-resolution strip is ready. Download it for the camera
            roll, or make a temporary QR link for the group chat.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="relative flex min-h-[480px] items-center justify-center overflow-hidden rounded-[2rem] border border-ink/10 bg-white/25 p-6 sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(245,216,210,0.55),transparent_48%)]" />
            <span className="pointer-events-none absolute left-[8%] top-[12%] font-display text-3xl text-rose/60">
              ✦
            </span>
            <span className="pointer-events-none absolute bottom-[12%] right-[9%] text-xl text-ink/20">
              ♡
            </span>
            <div className="relative z-10 w-full max-w-[360px]">
              <img
                src={published.stripDataUrl}
                alt="Your finished MOMENT photo strip"
                className="mx-auto block h-auto w-full rounded-[1.25rem] shadow-strip"
              />
            </div>
          </section>

          <aside className="space-y-4">
            <div className="panel p-6">
              <p className="eyebrow">Your keepsake</p>
              <h2 className="mt-2 font-display text-3xl">
                {LAYOUT_LABELS[published.session.layout]}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                <span className="rounded-full bg-ink/5 px-2.5 py-1.5">
                  {FRAME_LABELS[published.session.frame]} paper
                </span>
                <span className="rounded-full bg-ink/5 px-2.5 py-1.5">
                  PNG · high res
                </span>
                <span className="rounded-full bg-ink/5 px-2.5 py-1.5">
                  {published.media.filter((item) => item.kind === "frame").length} cuts
                </span>
              </div>

              <div className="mt-6 space-y-2.5">
                <a
                  href={published.stripDataUrl}
                  download={`moment-${published.session.id}.png`}
                  className="btn-primary w-full !py-4"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </a>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={isCreatingShare}
                  className="btn-secondary w-full !py-4"
                >
                  {isCreatingShare ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  {share ? "Show QR code" : "Create private QR"}
                </button>
              </div>

              {shareError && (
                <p className="mt-3 rounded-xl bg-rose/10 px-3 py-2 text-xs leading-5 text-rose">
                  {shareError}
                </p>
              )}

              <div className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-[10px] leading-5 text-muted">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                  Your photo session is private. Only this browser session and a
                  shared QR token can retrieve the media.
                </p>
                <p className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Session expires {formatExpiry(published.session.expiresAt)}.
                  {share && ` QR link expires ${formatExpiry(share.expiresAt)}.`}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-ink/10 bg-butter/25 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  One more thing
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Tag your strip with{" "}
                <span className="font-medium text-ink">#MOMENTbooth</span> and
                keep an eye on the light. The best strips are a little imperfect.
              </p>
            </div>

            <button
              type="button"
              onClick={onStartOver}
              className="btn-ghost w-full !py-3 text-xs"
            >
              Start another strip
            </button>
          </aside>
        </div>
      </main>

      {share && (
        <QrModal
          open={qrOpen}
          shareUrl={shareUrl}
          expiresAt={share.expiresAt}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}
