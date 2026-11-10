import {
  ArrowLeft,
  Clock,
  Download,
  Heart,
  Loader2,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { MediaSummary, ShareResponse } from "../../shared/contracts";
import { LAYOUT_LABELS } from "../../shared/contracts";
import { ApiError, getShare } from "../lib/api";
import { formatExpiry } from "../lib/utils";
import { Wordmark } from "./Brand";

interface SharePageProps {
  token: string;
}

export function SharePage({ token }: SharePageProps) {
  const [share, setShare] = useState<ShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void getShare(token)
      .then((result) => {
        if (!cancelled) setShare(result);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "This share link could not be opened.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const strip = share?.media.find((item) => item.kind === "strip");
  const frames = share?.media
    .filter((item) => item.kind === "frame")
    .sort((left, right) => left.position - right.position) ?? [];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <a href="/" className="btn-ghost !px-3">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Make your own</span>
          <span className="sm:hidden">Create</span>
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 sm:px-8">
        {loading && (
          <div className="panel flex min-h-[420px] flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-blush/50">
              <Loader2 className="h-5 w-5 animate-spin text-ink" />
            </div>
            <p className="font-display text-3xl">Opening the little moment</p>
            <p className="text-sm text-muted">Checking the private token...</p>
          </div>
        )}

        {!loading && error && (
          <div className="panel mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center sm:px-10">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-rose/10">
              <LockKeyhole className="h-5 w-5 text-rose" />
            </div>
            <p className="mt-5 font-display text-4xl">This link has left the booth.</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{error}</p>
            <a href="/" className="btn-primary mt-7">
              Make a new strip
            </a>
          </div>
        )}

        {!loading && !error && share && (
          <div className="animate-fade-up">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <Heart className="h-3.5 w-3.5 text-rose" />
                A moment shared with you
              </div>
              <h1 className="font-display text-5xl leading-[0.92] tracking-[-0.035em] sm:text-6xl">
                Someone cute
                <span className="italic text-rose"> thought of you.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted">
                {share.caption
                  ? `“${share.caption}”`
                  : share.layout === "postcard"
                    ? "A tiny postcard from the MOMENT booth."
                    : "A tiny four-cut memory from the MOMENT booth."}
              </p>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="relative flex min-h-[480px] items-center justify-center overflow-hidden rounded-[2rem] border border-ink/10 bg-white/30 p-6 sm:p-10">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(203,214,194,0.45),transparent_50%)]" />
                <span className="pointer-events-none absolute left-[8%] top-[12%] font-display text-3xl text-rose/60">
                  ✦
                </span>
                <span className="pointer-events-none absolute bottom-[12%] right-[9%] text-xl text-ink/20">
                  ♡
                </span>
                {strip ? (
                  <img
                    src={strip.url}
                    alt="Shared MOMENT photo strip"
                    className="relative z-10 mx-auto block h-auto w-full max-w-[380px] rounded-[1.2rem] shadow-strip"
                  />
                ) : (
                  <p className="relative z-10 text-sm text-muted">
                    The photo strip is still developing.
                  </p>
                )}
              </section>

              <aside className="space-y-4">
                <div className="panel p-6">
                  <p className="eyebrow">The details</p>
                  <h2 className="mt-2 font-display text-3xl">
                    {LAYOUT_LABELS[share.layout]}
                  </h2>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    This is a private, tokenized page. No account is needed to
                    view or download the strip.
                  </p>

                  {strip && (
                    <a
                      href={strip.downloadUrl}
                      className="btn-primary mt-5 w-full !py-4"
                    >
                      <Download className="h-4 w-4" />
                      Download strip
                    </a>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-[10px] text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    This link expires {formatExpiry(share.expiresAt)}
                  </div>

                  <div className="mt-5 flex items-start gap-2 border-t border-ink/10 pt-4 text-[10px] leading-5 text-muted">
                    <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                    Uploads are validated by file signature and stored under
                    unguessable names. The share token is hashed on the server.
                  </div>
                </div>

                {frames.length > 0 && (
                  <div className="panel p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="eyebrow">The outtakes</p>
                        <p className="mt-1 font-display text-2xl">Every cut</p>
                      </div>
                      <Sparkles className="h-4 w-4 text-rose" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {frames.map((frame: MediaSummary) => (
                        <a
                          key={frame.id}
                          href={frame.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group overflow-hidden rounded-xl border border-ink/10 bg-white/40"
                        >
                          <img
                            src={frame.url}
                            alt={`Shared photo frame ${frame.position + 1}`}
                            className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-[1.5rem] border border-ink/10 bg-butter/25 p-5 text-center">
                  <p className="font-display text-2xl">Your turn?</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Step into the booth and make a little moment of your own.
                  </p>
                  <a href="/" className="btn-secondary mt-4 w-full !py-3 !text-xs">
                    Open the booth
                  </a>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-ink/10 px-5 py-7 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>MOMENT · 모먼트 — a tiny photo studio for the internet.</span>
        <span>Private by default, cute by design.</span>
      </footer>
    </div>
  );
}
