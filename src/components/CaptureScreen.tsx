import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FlipHorizontal,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TimerSeconds } from "../../shared/contracts";
import { captureVideoFrame } from "../lib/capture";
import type { LayoutSpec } from "../lib/layouts";
import { cn, wait } from "../lib/utils";
import { useCamera } from "../hooks/useCamera";
import { StepMarker, Wordmark } from "./Brand";

interface CaptureScreenProps {
  layout: LayoutSpec;
  timer: TimerSeconds;
  frames: Array<string | null>;
  onCapture: (index: number, dataUrl: string) => void;
  onReset: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function CaptureScreen({
  layout,
  timer,
  frames,
  onCapture,
  onReset,
  onBack,
  onContinue,
}: CaptureScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const {
    status,
    error,
    stream,
    mirrored,
    setMirrored,
    start,
    stop,
  } = useCamera();

  const capturedCount = frames.filter((frame) => frame !== null).length;
  const allCaptured = capturedCount === layout.frameCount;

  useEffect(() => {
    mountedRef.current = true;
    void start();
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      stop();
    };
  }, [start, stop]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    const playPromise = video.play();
    if (playPromise) {
      void playPromise.catch(() => {
        setCaptureError("Tap the camera preview to start the video.");
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const runSequence = async (indices: number[]) => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setCaptureError(null);
    setIsShooting(true);
    setReviewing(false);

    for (const index of indices) {
      if (!mountedRef.current || runIdRef.current !== runId) return;
      setActiveIndex(index);
      setCountdown(timer);

      for (let remaining = timer; remaining > 0; remaining -= 1) {
        if (!mountedRef.current || runIdRef.current !== runId) return;
        setCountdown(remaining);
        await wait(1000);
      }

      if (!mountedRef.current || runIdRef.current !== runId) return;
      setCountdown(null);
      setFlash(true);
      await wait(120);

      try {
        const video = videoRef.current;
        if (!video) throw new Error("The camera is not ready.");
        const dataUrl = captureVideoFrame(video, {
          aspect: layout.photoAspect,
          mirrored,
        });
        onCapture(index, dataUrl);
      } catch (captureFailure) {
        if (!mountedRef.current || runIdRef.current !== runId) return;
        setCaptureError(
          captureFailure instanceof Error
            ? captureFailure.message
            : "That frame could not be captured. Please try again.",
        );
        setIsShooting(false);
        setFlash(false);
        setCountdown(null);
        return;
      }

      await wait(560);
      if (!mountedRef.current || runIdRef.current !== runId) return;
      setFlash(false);
    }

    if (!mountedRef.current || runIdRef.current !== runId) return;
    setIsShooting(false);
    setActiveIndex(null);
    setCountdown(null);
    setReviewing(true);
  };

  const startSession = () => {
    const missing = frames
      .map((frame, index) => (frame === null ? index : -1))
      .filter((index) => index >= 0);
    if (missing.length === 0) {
      setReviewing(true);
      return;
    }
    void runSequence(missing);
  };

  const retakeFrame = (index: number) => {
    if (isShooting || status !== "ready") return;
    void runSequence([index]);
  };

  const resetSession = () => {
    runIdRef.current += 1;
    setIsShooting(false);
    setReviewing(false);
    setCountdown(null);
    setActiveIndex(null);
    setCaptureError(null);
    onReset();
  };

  const cameraUnavailable = status === "error";
  const isCounting = countdown !== null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Wordmark />
        <div className="hidden items-center gap-8 md:flex">
          <StepMarker step="01" label="Shoot" active />
          <span className="h-px w-8 bg-ink/15" />
          <StepMarker step="02" label="Style" />
          <span className="h-px w-8 bg-ink/15" />
          <StepMarker step="03" label="Keep" />
        </div>
        <button type="button" onClick={onBack} className="btn-ghost !px-3">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Exit booth</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-12 pt-3 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The shoot</p>
            <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] sm:text-5xl">
              Find your light.
            </h1>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-ink/10 bg-paper/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose" />
              {capturedCount} / {layout.frameCount} captured
            </span>
            <span className="h-3 w-px bg-ink/15" />
            <span>{timer}s timer</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-[2rem] bg-ink p-3 shadow-strip sm:p-4">
            <div
              className="relative overflow-hidden rounded-[1.4rem] bg-[#0d0c0b]"
              style={{ aspectRatio: layout.photoAspect }}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onClick={() => {
                  void videoRef.current?.play();
                }}
                className={cn(
                  "h-full w-full object-cover transition duration-500",
                  mirrored && "-scale-x-100",
                  (status === "requesting" || cameraUnavailable) && "opacity-0",
                )}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35" />

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isShooting ? "animate-pulse bg-rose" : "bg-white/60",
                  )}
                />
                {isShooting ? "Recording" : "Live view"}
              </div>

              <button
                type="button"
                onClick={() => setMirrored(!mirrored)}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
                aria-label={mirrored ? "Turn off mirror mode" : "Turn on mirror mode"}
              >
                <FlipHorizontal className="h-4 w-4" />
              </button>

              {status === "requesting" && (
                <div className="absolute inset-0 grid place-items-center text-white">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-rose" />
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Warming up the lens
                    </p>
                  </div>
                </div>
              )}

              {cameraUnavailable && (
                <div className="absolute inset-0 grid place-items-center p-6">
                  <div className="max-w-sm rounded-3xl border border-white/15 bg-white/10 p-6 text-center text-white backdrop-blur-md">
                    <Camera className="mx-auto h-7 w-7 text-rose" />
                    <h2 className="mt-4 font-display text-2xl">Camera, please.</h2>
                    <p className="mt-2 text-sm leading-6 text-white/65">{error}</p>
                    <button
                      type="button"
                      onClick={() => void start()}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-ink transition hover:bg-white/90"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {isCounting && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative grid h-32 w-32 place-items-center rounded-full border border-white/20 bg-black/15 text-white backdrop-blur-sm sm:h-40 sm:w-40">
                    <span className="absolute inset-0 animate-ping rounded-full border border-white/20" />
                    <span
                      key={countdown}
                      className="animate-fade-up font-display text-7xl leading-none sm:text-8xl"
                    >
                      {countdown}
                    </span>
                  </div>
                </div>
              )}

              {isShooting && activeIndex !== null && !isCounting && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5">
                  <span className="rounded-full bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
                    Holding frame {activeIndex + 1}
                  </span>
                </div>
              )}

              {!isShooting && !reviewing && !allCaptured && status === "ready" && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-6 pb-8 pt-16 text-center text-white">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                      {layout.frameCount === 1 ? "One perfect frame" : `${layout.frameCount} little frames`}
                    </p>
                    <p className="mt-2 font-display text-2xl sm:text-3xl">Ready when you are.</p>
                  </div>
                  <button
                    type="button"
                    onClick={startSession}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:bg-white/90"
                  >
                    <Camera className="h-4 w-4" />
                    Start the countdown
                  </button>
                </div>
              )}

              {reviewing && status === "ready" && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/75 to-transparent px-6 pb-8 pt-16 text-center text-white">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                    <Check className="h-3.5 w-3.5 text-sage" />
                    All frames captured
                  </div>
                  <p className="font-display text-2xl sm:text-3xl">That was cute.</p>
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={!allCaptured}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:bg-white/90 disabled:opacity-40"
                  >
                    Style your strip
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {flash && <div className="pointer-events-none absolute inset-0 animate-flash bg-white" />}
            </div>

            <div className="mt-4 flex items-center justify-between px-2 pb-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/35">
              <span>Mirrored preview</span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Local capture
              </span>
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <div className="panel flex-1 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Your film</p>
                  <h2 className="mt-1 font-display text-2xl">
                    {layout.frameCount === 1 ? "The one cut" : "The four cuts"}
                  </h2>
                </div>
                <Sparkles className="h-5 w-5 text-rose" />
              </div>

              <div className="mt-5 space-y-2.5">
                {frames.map((frame, index) => (
                  <div
                    key={`frame-${index}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-2 transition",
                      activeIndex === index && isShooting
                        ? "border-rose/60 bg-blush/25"
                        : "border-ink/10 bg-white/35",
                    )}
                  >
                    <div className="relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                      {frame ? (
                        <img
                          src={frame}
                          alt={`Captured frame ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
                          Empty
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">Cut {String(index + 1).padStart(2, "0")}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {frame ? "Ready for styling" : activeIndex === index && isShooting ? "Smile..." : "Not shot yet"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => retakeFrame(index)}
                      disabled={!frame || isShooting || status !== "ready"}
                      className="icon-button !h-8 !w-8 !border-0 !bg-transparent hover:!bg-ink/5"
                      aria-label={`Retake frame ${index + 1}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {captureError && (
                <p className="mt-4 rounded-xl bg-rose/10 px-3 py-2 text-xs leading-5 text-rose">
                  {captureError}
                </p>
              )}

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={onContinue}
                  disabled={!allCaptured}
                  className="btn-primary w-full"
                >
                  Style your strip
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetSession}
                  disabled={isShooting || capturedCount === 0}
                  className="btn-ghost w-full !py-2 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start this shoot over
                </button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-ink/10 bg-butter/20 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                A little direction
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/75">
                {layout.frameCount === 1
                  ? "One frame, one mood. Take your time, then let the timer do the rest."
                  : "Each shot starts automatically. Use the tiny retake arrow after the shoot if one cut feels off."}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
