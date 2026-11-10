import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  QrCode,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, formatExpiry } from "../lib/utils";

interface QrModalProps {
  open: boolean;
  shareUrl: string;
  expiresAt: string;
  onClose: () => void;
}

export function QrModal({ open, shareUrl, expiresAt, onClose }: QrModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setQrDataUrl(null);
    setQrError(null);
    setCopied(false);

    void QRCode.toDataURL(shareUrl, {
      width: 560,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#1F1B18",
        light: "#FCF9F3",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError("The QR code could not be generated.");
      });

    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-ink/60 px-4 py-8 backdrop-blur-md"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="relative w-full max-w-lg overflow-hidden rounded-[2rem] bg-paper shadow-soft"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 icon-button !bg-paper/80"
          aria-label="Close QR code"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid gap-0 sm:grid-cols-[0.92fr_1.08fr]">
          <div className="relative flex items-center justify-center bg-blush/35 p-7">
            <div className="absolute left-5 top-5 h-6 w-6 border-l border-t border-ink/20" />
            <div className="absolute bottom-5 right-5 h-6 w-6 border-b border-r border-ink/20" />
            <div className="rounded-[1.4rem] bg-paper p-3 shadow-card">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR code for your private MOMENT share link"
                  className="h-44 w-44 sm:h-48 sm:w-48"
                />
              ) : qrError ? (
                <div className="grid h-44 w-44 place-items-center p-4 text-center sm:h-48 sm:w-48">
                  <p className="text-xs leading-5 text-rose">{qrError}</p>
                </div>
              ) : (
                <div className="grid h-44 w-44 place-items-center sm:h-48 sm:w-48">
                  <Loader2 className="h-5 w-5 animate-spin text-muted" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-7">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              <QrCode className="h-3.5 w-3.5" />
              Private QR
            </div>
            <h2 id="share-title" className="mt-3 font-display text-3xl leading-tight">
              Your moment, to pass around.
            </h2>
            <p className="mt-3 text-xs leading-5 text-muted">
              Scan to open the photo strip. The link is tokenized, temporary,
              and only reveals this session.
            </p>

            <div className="mt-5 rounded-2xl border border-ink/10 bg-white/50 p-3">
              <p className="break-all font-mono text-[9px] leading-4 text-muted">{shareUrl}</p>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
              <Clock className="h-3 w-3" />
              Expires {formatExpiry(expiresAt)}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className={cn("btn-secondary flex-1 !px-4 !py-2.5 !text-xs", copied && "!border-sage")}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary !px-4 !py-2.5 !text-xs"
              >
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-muted/80">
              <Lock className="h-3 w-3" />
              Anyone with the link can view this strip
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
