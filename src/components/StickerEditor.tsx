import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Heart,
  Layers,
  Loader2,
  MoveDown,
  MoveUp,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FRAME_LABELS, type FrameId } from "../../shared/contracts";
import { useElementWidth } from "../hooks/useElementWidth";
import { composeStrip } from "../lib/compose";
import {
  buildFilterString,
  FILTER_OPTIONS,
  PHOTO_FILTERS,
  type FilterId,
} from "../lib/filters";
import { layoutFor } from "../lib/layouts";
import {
  getStickerDefinition,
  STICKER_GROUPS,
  stickerColors,
} from "../lib/stickers";
import { FRAME_THEMES, themeFor } from "../lib/themes";
import { clamp, cn } from "../lib/utils";
import type {
  BoothConfig,
  CompositionSettings,
  PhotoAdjustments,
  PlacedSticker,
} from "../types";
import { StepMarker, Wordmark } from "./Brand";
import { StickerNode } from "./StickerNode";

type EditorTab = "stickers" | "light" | "frame" | "stamp";

interface StickerEditorProps {
  config: BoothConfig;
  frames: string[];
  onConfigChange: (config: BoothConfig) => void;
  onBack: () => void;
  onDevelop: (stripDataUrl: string, settings: CompositionSettings) => Promise<void>;
}

function makeStickerId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sticker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StickerEditor({
  config,
  frames,
  onConfigChange,
  onBack,
  onDevelop,
}: StickerEditorProps) {
  const layout = layoutFor(config.layout);
  const theme = themeFor(config.frame);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: previewRef, width: previewWidth } = useElementWidth<HTMLDivElement>();

  const [tab, setTab] = useState<EditorTab>("stickers");
  const [activeGroup, setActiveGroup] = useState("love");
  const [filterId, setFilterId] = useState<FilterId>("studio-glow");
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>({
    brightness: 100,
    contrast: 100,
  });
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [developError, setDevelopError] = useState<string | null>(null);
  const [isDeveloping, setIsDeveloping] = useState(false);

  const selectedSticker = stickers.find((sticker) => sticker.id === selectedId) ?? null;
  const selectedDefinition = selectedSticker
    ? getStickerDefinition(selectedSticker.definitionId)
    : undefined;

  const updateConfig = (patch: Partial<BoothConfig>) => {
    onConfigChange({ ...config, ...patch });
  };

  useEffect(() => {
    let cancelled = false;
    setIsPreviewing(true);
    setPreviewError(null);

    const settings: CompositionSettings = {
      filterId,
      adjustments,
      stickers: [],
      caption: config.caption,
      showDate: config.showDate,
      frame: config.frame,
    };

    void composeStrip(frames, config.layout, settings, {
      width: Math.round(layout.previewWidth * 1.6),
    })
      .then((composed) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = composed.width;
        canvas.height = composed.height;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(composed, 0, 0);
        setIsPreviewing(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setIsPreviewing(false);
        setPreviewError(
          error instanceof Error
            ? error.message
            : "The strip preview could not be rendered.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    frames,
    config.layout,
    config.frame,
    config.caption,
    config.showDate,
    filterId,
    adjustments,
    layout.previewWidth,
  ]);

  const addSticker = (definitionId: string) => {
    const definition = getStickerDefinition(definitionId);
    if (!definition) return;
    const highestZ = stickers.reduce((max, item) => Math.max(max, item.zIndex), 0);
    const offset = (stickers.length % 4) * 0.035;
    const next: PlacedSticker = {
      id: makeStickerId(),
      definitionId,
      x: clamp(0.5 + offset, 0.12, 0.88),
      y: clamp(0.43 + offset, 0.12, 0.88),
      scale: 1,
      rotation: stickers.length % 2 === 0 ? -7 : 7,
      zIndex: highestZ + 1,
    };
    setStickers((current) => [...current, next]);
    setSelectedId(next.id);
    setTab("stickers");
  };

  const updateSticker = (id: string, patch: Partial<PlacedSticker>) => {
    setStickers((current) =>
      current.map((sticker) => (sticker.id === id ? { ...sticker, ...patch } : sticker)),
    );
  };

  const removeSticker = (id: string) => {
    setStickers((current) => current.filter((sticker) => sticker.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateSticker = (sticker: PlacedSticker) => {
    const highestZ = stickers.reduce((max, item) => Math.max(max, item.zIndex), 0);
    const copy: PlacedSticker = {
      ...sticker,
      id: makeStickerId(),
      x: clamp(sticker.x + 0.045, 0.04, 0.96),
      y: clamp(sticker.y + 0.045, 0.04, 0.96),
      zIndex: highestZ + 1,
    };
    setStickers((current) => [...current, copy]);
    setSelectedId(copy.id);
  };

  const moveLayer = (direction: "up" | "down") => {
    if (!selectedSticker) return;
    if (direction === "up") {
      const highestZ = stickers.reduce((max, item) => Math.max(max, item.zIndex), 0);
      updateSticker(selectedSticker.id, { zIndex: highestZ + 1 });
    } else {
      const lowestZ = stickers.reduce(
        (min, item) => Math.min(min, item.zIndex),
        Number.POSITIVE_INFINITY,
      );
      updateSticker(selectedSticker.id, {
        zIndex: Number.isFinite(lowestZ) ? lowestZ - 1 : 0,
      });
    }
  };

  const resetLight = () => {
    setFilterId("studio-glow");
    setAdjustments({ brightness: 100, contrast: 100 });
  };

  const handleDevelop = async () => {
    setDevelopError(null);
    setIsDeveloping(true);

    try {
      const settings: CompositionSettings = {
        filterId,
        adjustments,
        stickers,
        caption: config.caption,
        showDate: config.showDate,
        frame: config.frame,
      };
      const composed = await composeStrip(frames, config.layout, settings);
      const dataUrl = composed.toDataURL("image/png");
      await onDevelop(dataUrl, settings);
    } catch (error) {
      setDevelopError(
        error instanceof Error
          ? error.message
          : "Your strip could not be developed. Please try again.",
      );
      setIsDeveloping(false);
    }
  };

  const activeStickerGroup =
    STICKER_GROUPS.find((group) => group.id === activeGroup) ?? STICKER_GROUPS[0];

  const filterPreviewStyle = useMemo(
    () => ({
      filter: buildFilterString(filterId, adjustments.brightness, adjustments.contrast),
    }),
    [filterId, adjustments],
  );

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Wordmark />
        <div className="hidden items-center gap-8 md:flex">
          <StepMarker step="01" label="Shoot" />
          <span className="h-px w-8 bg-ink/15" />
          <StepMarker step="02" label="Style" active />
          <span className="h-px w-8 bg-ink/15" />
          <StepMarker step="03" label="Keep" />
        </div>
        <button type="button" onClick={onBack} className="btn-ghost !px-3">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to shoot</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-16 pt-3 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The styling room</p>
            <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] sm:text-5xl">
              Make it yours.
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted">
            Add a little chaos, a little softness. Everything here is composited
            into your final PNG.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <section className="relative flex min-h-[420px] flex-col items-center overflow-hidden rounded-[2rem] border border-ink/10 bg-white/25 px-5 py-8 sm:px-10 sm:py-10 lg:sticky lg:top-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background: `radial-gradient(circle at 50% 18%, ${theme.accent}25, transparent 45%)`,
              }}
            />
            <span className="pointer-events-none absolute left-[8%] top-[12%] font-display text-3xl text-rose/60">
              ✦
            </span>
            <span className="pointer-events-none absolute bottom-[10%] right-[9%] font-display text-2xl text-ink/20">
              ♡
            </span>

            <div className="relative z-10 flex w-full flex-1 items-center justify-center">
              <div
                ref={previewRef}
                className="relative overflow-hidden rounded-[1.4rem] shadow-strip"
                style={{ width: `min(100%, ${layout.previewWidth}px)` }}
              >
                <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Your photo strip preview" />
                <div
                  className="absolute inset-0 touch-none"
                  onPointerDown={() => setSelectedId(null)}
                >
                  {stickers.map((sticker) => {
                    const definition = getStickerDefinition(sticker.definitionId);
                    if (!definition) return null;
                    return (
                      <StickerNode
                        key={sticker.id}
                        sticker={sticker}
                        definition={definition}
                        theme={theme}
                        selected={sticker.id === selectedId}
                        previewWidth={previewWidth}
                        containerRef={previewRef}
                        onSelect={() => setSelectedId(sticker.id)}
                        onChange={(patch) => updateSticker(sticker.id, patch)}
                      />
                    );
                  })}
                </div>

                {isPreviewing && (
                  <div className="absolute inset-0 grid place-items-center bg-paper/40 backdrop-blur-[1px]">
                    <span className="inline-flex items-center gap-2 rounded-full bg-paper/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Rendering
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative z-10 mt-6 flex w-full max-w-[520px] items-center justify-between gap-3 border-t border-ink/10 pt-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                {FRAME_LABELS[config.frame]}
              </p>
              <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                <Sparkles className="h-3 w-3 text-rose" />
                Drag · resize · rotate
              </p>
            </div>

            {previewError && (
              <p className="relative z-10 mt-3 rounded-xl bg-rose/10 px-3 py-2 text-xs text-rose">
                {previewError}
              </p>
            )}
          </section>

          <aside className="panel overflow-hidden">
            <div className="grid grid-cols-4 border-b border-ink/10">
              {[
                { id: "stickers" as const, label: "Stickers", icon: Heart },
                { id: "light" as const, label: "Light", icon: SlidersHorizontal },
                { id: "frame" as const, label: "Frame", icon: Palette },
                { id: "stamp" as const, label: "Stamp", icon: Type },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 border-b-2 px-2 py-4 text-[9px] font-semibold uppercase tracking-[0.12em] transition",
                    tab === item.id
                      ? "border-ink bg-white/40 text-ink"
                      : "border-transparent text-muted hover:bg-white/25 hover:text-ink",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-5 sm:p-6">
              {tab === "stickers" && (
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Sticker drawer</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        Tap to add. Drag on the strip to place.
                      </p>
                    </div>
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {stickers.length} added
                    </span>
                  </div>

                  <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {STICKER_GROUPS.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroup(group.id)}
                        className={cn(
                          "shrink-0 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition",
                          activeGroup === group.id
                            ? "bg-ink text-paper"
                            : "bg-ink/5 text-muted hover:bg-ink/10 hover:text-ink",
                        )}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {activeStickerGroup?.items.map((definition) => {
                      const colors = stickerColors(definition, theme);
                      return (
                        <button
                          key={definition.id}
                          type="button"
                          onClick={() => addSticker(definition.id)}
                          title={definition.label}
                          aria-label={`Add ${definition.label}`}
                          className="flex aspect-square items-center justify-center rounded-2xl border border-ink/10 bg-white/45 p-1.5 transition hover:-translate-y-0.5 hover:border-ink/25 hover:bg-white/80"
                        >
                          {definition.kind === "emoji" ? (
                            <span className="text-2xl leading-none">{definition.glyph}</span>
                          ) : (
                            <span
                              className="max-w-full truncate rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wide"
                              style={{
                                color: colors.color,
                                background: colors.background,
                                border:
                                  definition.variant === "outline"
                                    ? `1px solid ${colors.border}`
                                    : "none",
                              }}
                            >
                              {definition.glyph}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedSticker && selectedDefinition && (
                    <div className="mt-5 rounded-2xl border border-ink/10 bg-white/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                            Selected sticker
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {selectedDefinition.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="icon-button !h-8 !w-8"
                            onClick={() => moveLayer("down")}
                            aria-label="Send sticker backward"
                          >
                            <MoveDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="icon-button !h-8 !w-8"
                            onClick={() => moveLayer("up")}
                            aria-label="Bring sticker forward"
                          >
                            <MoveUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="icon-button !h-8 !w-8"
                            onClick={() => duplicateSticker(selectedSticker)}
                            aria-label="Duplicate sticker"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="icon-button !h-8 !w-8 !text-rose"
                            onClick={() => removeSticker(selectedSticker.id)}
                            aria-label="Delete sticker"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                            Size
                            <span>{Math.round(selectedSticker.scale * 100)}%</span>
                          </span>
                          <input
                            type="range"
                            min="35"
                            max="400"
                            step="1"
                            value={Math.round(selectedSticker.scale * 100)}
                            onChange={(event) =>
                              updateSticker(selectedSticker.id, {
                                scale: clamp(Number(event.target.value) / 100, 0.35, 4),
                              })
                            }
                            className="mt-2"
                          />
                        </label>
                        <label className="block">
                          <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                            Rotation
                            <span>{selectedSticker.rotation}°</span>
                          </span>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            step="1"
                            value={selectedSticker.rotation}
                            onChange={(event) =>
                              updateSticker(selectedSticker.id, {
                                rotation: Number(event.target.value),
                              })
                            }
                            className="mt-2"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "light" && (
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Studio light</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        Film tones, softness, and a little analogue noise.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetLight}
                      className="icon-button !h-8 !w-8"
                      aria-label="Reset light settings"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {FILTER_OPTIONS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setFilterId(filter.id)}
                        aria-pressed={filterId === filter.id}
                        className={cn(
                          "overflow-hidden rounded-2xl border text-left transition",
                          filterId === filter.id
                            ? "border-ink bg-white/65 shadow-sm"
                            : "border-ink/10 bg-white/35 hover:border-ink/25",
                        )}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-blush to-sky">
                          {frames[0] && (
                            <img
                              src={frames[0]}
                              alt=""
                              style={{
                                filter: buildFilterString(
                                  filter.id,
                                  adjustments.brightness,
                                  adjustments.contrast,
                                ),
                              }}
                              className="h-full w-full object-cover"
                            />
                          )}
                          {filter.grain > 0 && (
                            <span className="pointer-events-none absolute inset-0 grain-overlay opacity-50 mix-blend-soft-light" />
                          )}
                          {filterId === filter.id && (
                            <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="text-[11px] font-medium">{filter.label}</p>
                          <p className="mt-0.5 truncate text-[9px] text-muted">
                            {filter.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 space-y-4 rounded-2xl border border-ink/10 bg-white/40 p-4">
                    <label className="block">
                      <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                        Brightness
                        <span>{adjustments.brightness}%</span>
                      </span>
                      <input
                        type="range"
                        min="80"
                        max="120"
                        step="1"
                        value={adjustments.brightness}
                        onChange={(event) =>
                          setAdjustments((current) => ({
                            ...current,
                            brightness: Number(event.target.value),
                          }))
                        }
                        className="mt-2"
                      />
                    </label>
                    <label className="block">
                      <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                        Contrast
                        <span>{adjustments.contrast}%</span>
                      </span>
                      <input
                        type="range"
                        min="80"
                        max="120"
                        step="1"
                        value={adjustments.contrast}
                        onChange={(event) =>
                          setAdjustments((current) => ({
                            ...current,
                            contrast: Number(event.target.value),
                          }))
                        }
                        className="mt-2"
                      />
                    </label>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10">
                    <div className="relative aspect-[4/3]">
                      {frames[0] && (
                        <img
                          src={frames[0]}
                          alt="Filter preview"
                          className="h-full w-full object-cover"
                          style={filterPreviewStyle}
                        />
                      )}
                      {PHOTO_FILTERS[filterId].grain > 0 && (
                        <span className="pointer-events-none absolute inset-0 grain-overlay opacity-60 mix-blend-soft-light" />
                      )}
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                        {PHOTO_FILTERS[filterId].label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "frame" && (
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-medium">Paper & border</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      {config.layout === "postcard"
                        ? "Pick the little world around your postcard."
                        : "Pick the little world around your four cuts."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.values(FRAME_THEMES).map((frameTheme) => (
                      <button
                        key={frameTheme.id}
                        type="button"
                        onClick={() => updateConfig({ frame: frameTheme.id as FrameId })}
                        aria-pressed={config.frame === frameTheme.id}
                        className={cn(
                          "overflow-hidden rounded-2xl border text-left transition",
                          config.frame === frameTheme.id
                            ? "border-ink shadow-sm"
                            : "border-ink/10 hover:border-ink/30",
                        )}
                      >
                        <span
                          className="block h-20 w-full"
                          style={{ background: frameTheme.cssBackground }}
                        >
                          <span className="flex h-full flex-col items-center justify-center gap-1">
                            <span
                              className="font-display text-sm"
                              style={{ color: frameTheme.ink }}
                            >
                              MOMENT
                            </span>
                            <span
                              className="text-[6px] font-semibold uppercase tracking-[0.22em]"
                              style={{ color: frameTheme.softInk }}
                            >
                              모먼트
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                          <span className="truncate text-[10px] font-medium">
                            {frameTheme.label}
                          </span>
                          {config.frame === frameTheme.id && (
                            <Check className="h-3 w-3 shrink-0" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl bg-ink/[0.04] p-4 text-[11px] leading-5 text-muted">
                    The frame, header, date, and border are all drawn into the
                    final high-resolution PNG.
                  </div>
                </div>
              )}

              {tab === "stamp" && (
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-medium">Date & little words</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      A tiny caption for the bottom of your strip.
                    </p>
                  </div>

                  <label htmlFor="editor-caption" className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Caption
                    </span>
                    <input
                      id="editor-caption"
                      className="input-field"
                      maxLength={40}
                      placeholder="seoul, with you"
                      value={config.caption}
                      onChange={(event) => updateConfig({ caption: event.target.value })}
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["seoul, with you", "a good day", "xoxo", "our little moment"].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateConfig({ caption: preset })}
                          className="rounded-full bg-ink/5 px-3 py-1.5 text-[10px] text-muted transition hover:bg-ink/10 hover:text-ink"
                        >
                          {preset}
                        </button>
                      ),
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white/40 p-4">
                    <div>
                      <p className="text-sm font-medium">Date stamp</p>
                      <p className="mt-1 text-[11px] text-muted">
                        Minimalist day, month, year
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={config.showDate}
                      onClick={() => updateConfig({ showDate: !config.showDate })}
                      className={cn(
                        "relative h-7 w-12 shrink-0 rounded-full border transition",
                        config.showDate ? "border-ink bg-ink" : "border-ink/15 bg-ink/10",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-paper shadow-sm transition",
                          config.showDate ? "left-6" : "left-1",
                        )}
                      />
                      <span className="sr-only">Show date stamp</span>
                    </button>
                  </div>

                  <div className="mt-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Type stamps
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {STICKER_GROUPS.find((group) => group.id === "kpop")?.items.map(
                        (definition) => (
                          <button
                            key={definition.id}
                            type="button"
                            onClick={() => addSticker(definition.id)}
                            className="rounded-full border border-ink/15 px-3 py-2 text-[9px] font-bold uppercase tracking-wider transition hover:bg-ink hover:text-paper"
                          >
                            {definition.glyph}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-ink/10 bg-paper/70 p-5 sm:p-6">
              {developError && (
                <p className="mb-3 rounded-xl bg-rose/10 px-3 py-2 text-xs leading-5 text-rose">
                  {developError}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleDevelop()}
                disabled={isDeveloping || isPreviewing}
                className="btn-primary w-full !py-4"
              >
                {isDeveloping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Developing...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4" />
                    Develop the strip
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-[10px] leading-4 text-muted">
                Uploads are validated and stored privately. Only your session and
                an expiring QR link can access the result.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {isDeveloping && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-5 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[2rem] bg-paper p-8 text-center shadow-soft">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blush/60">
              <Loader2 className="h-6 w-6 animate-spin text-ink" />
            </div>
            <p className="mt-5 font-display text-3xl">Developing your strip</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Compositing at full resolution and tucking it into your private
              photo session.
            </p>
            <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full w-1/2 animate-[fade-up_1.4s_ease-in-out_infinite_alternate] rounded-full bg-ink/50" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
